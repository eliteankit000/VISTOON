import { createClient } from "@supabase/supabase-js";
import type { Observation } from "../../src/lib/dna/extract";
import type { Finding } from "../../src/lib/dna/findings";

/** Everything the worker needs from the database, as an interface so tests can substitute a recorder. */
export interface Db {
  reapStuckJobs(staleSeconds: number, maxAttempts: number): Promise<{ jobId: string; ownerId: string; action: string }[]>;
  staleQueuedJobs(olderThanSeconds: number): Promise<{ jobId: string; ownerId: string }[]>;
  stalePendingAssets(olderThanMinutes: number, limit: number): Promise<{ id: string; storageKey: string }[]>;
  removeStorage(keys: string[]): Promise<void>; // throws if removal fails
  deleteAssets(ids: string[]): Promise<void>;
  recordAudit(e: { action: string; target?: string; meta?: Record<string, unknown> }): Promise<void>;
  recordUsage(e: { userId: string; kind: string; quantity: number; costUsd?: number }): Promise<void>;
  upsertWorkerStatus(e: { workerId: string; startedAt: string; info: Record<string, unknown> }): Promise<void>;
  ping(): Promise<boolean>;
  // DNA Analyzer
  claimAnalysis(analysisId: string): Promise<{ userId: string; collectionId: string } | null>; // queued -> running, atomically
  loadDnaTranscripts(collectionId: string, promptVersion: string): Promise<DnaTranscript[]>;
  saveObservations(e: { userId: string; transcriptId: string; promptVersion: string; observations: Observation[] }): Promise<void>;
  saveFindings(e: { userId: string; collectionId: string; findings: Finding[] }): Promise<void>;
  finishAnalysis(analysisId: string, e: { status: "completed" | "failed"; error?: string; model?: string; transcriptCount?: number }): Promise<void>;
}
export type DnaTranscript = { id: string; title: string; body: string; highPerformer: boolean; observations: Observation[] | null };

export function supabaseDb(url: string, serviceKey: string): Db {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const BUCKET = "vistoon-private";
  const ok = <T>(r: { data: T | null; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    async reapStuckJobs(staleSeconds, maxAttempts) {
      const rows = ok(await sb.rpc("reap_stuck_jobs", { stale_after: `${staleSeconds} seconds`, max_attempts: maxAttempts })) ?? [];
      return (rows as { out_job_id: string; out_owner_id: string; out_action: string }[]).map((r) => ({ jobId: r.out_job_id, ownerId: r.out_owner_id, action: r.out_action }));
    },
    async staleQueuedJobs(olderThanSeconds) {
      const rows = ok(await sb.rpc("stale_queued_jobs", { older_than: `${olderThanSeconds} seconds` })) ?? [];
      return (rows as { out_job_id: string; out_owner_id: string }[]).map((r) => ({ jobId: r.out_job_id, ownerId: r.out_owner_id }));
    },
    async stalePendingAssets(olderThanMinutes, limit) {
      const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
      const rows = ok(await sb.from("assets").select("id, storage_key").eq("status", "pending").lt("created_at", cutoff).limit(limit)) ?? [];
      return rows.map((r) => ({ id: r.id as string, storageKey: r.storage_key as string }));
    },
    async removeStorage(keys) {
      if (keys.length === 0) return;
      const { error } = await sb.storage.from(BUCKET).remove(keys);
      if (error) throw new Error(`storage remove failed: ${error.message}`);
    },
    async deleteAssets(ids) { if (ids.length) ok(await sb.from("assets").delete().in("id", ids).eq("status", "pending")); },
    async recordAudit(e) { ok(await sb.from("audit_log").insert({ actor: null, action: e.action, target: e.target ?? null, meta: e.meta ?? null })); },
    async recordUsage(e) { ok(await sb.from("usage_events").insert({ user_id: e.userId, kind: e.kind, quantity: e.quantity, cost_usd: e.costUsd ?? null })); },
    async upsertWorkerStatus(e) {
      ok(await sb.from("worker_status").upsert({ worker_id: e.workerId, started_at: e.startedAt, last_seen: new Date().toISOString(), info: e.info }));
    },
    async claimAnalysis(id) {
      const { data, error } = await sb.from("dna_analyses").update({ status: "running" }).eq("id", id).eq("status", "queued").select("user_id, collection_id").maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { userId: data.user_id as string, collectionId: data.collection_id as string } : null;
    },
    async loadDnaTranscripts(collectionId, promptVersion) {
      const rows = ok(await sb.from("dna_transcripts").select("id, title, body, high_performer").eq("collection_id", collectionId).eq("excluded", false).order("created_at")) ?? [];
      const ids = rows.map((r) => r.id as string);
      const obs = ids.length ? ok(await sb.from("dna_observations").select("transcript_id, observations").eq("prompt_version", promptVersion).in("transcript_id", ids)) ?? [] : [];
      const byId = new Map(obs.map((o) => [o.transcript_id as string, o.observations as Observation[]]));
      return rows.map((r) => ({ id: r.id as string, title: r.title as string, body: r.body as string, highPerformer: r.high_performer as boolean, observations: byId.get(r.id as string) ?? null }));
    },
    async saveObservations(e) {
      ok(await sb.from("dna_observations").upsert({ user_id: e.userId, transcript_id: e.transcriptId, prompt_version: e.promptVersion, observations: e.observations }, { onConflict: "transcript_id,prompt_version" }));
    },
    async saveFindings(e) {
      const existing = ok(await sb.from("dna_findings").select("id, technique_key, status").eq("collection_id", e.collectionId)) ?? [];
      const byKey = new Map(existing.map((x) => [x.technique_key as string, x]));
      for (const f of e.findings) {
        const machine = { label: f.label, technique: f.technique, sample_count: f.sampleCount, evidence: f.evidence, counterexamples: f.counterexamples, confidence: f.confidence };
        const prev = byKey.get(f.techniqueKey);
        if (!prev) ok(await sb.from("dna_findings").insert({ user_id: e.userId, collection_id: e.collectionId, technique_key: f.techniqueKey, explanation: f.explanation, status: "proposed", ...machine }));
        // User-edited text is never overwritten; machine fields (label, counts, evidence) always reflect the current data.
        else ok(await sb.from("dna_findings").update(prev.status === "edited" ? machine : { explanation: f.explanation, ...machine }).eq("id", prev.id as string));
      }
      const keep = new Set<string>(e.findings.map((f) => f.techniqueKey));
      const stale = existing.filter((x) => x.status === "proposed" && x.technique_key && !keep.has(x.technique_key as string)).map((x) => x.id as string);
      if (stale.length) ok(await sb.from("dna_findings").delete().in("id", stale));
    },
    async finishAnalysis(id, e) {
      ok(await sb.from("dna_analyses").update({ status: e.status, error: e.error?.slice(0, 300) ?? null, model: e.model ?? null, transcript_count: e.transcriptCount ?? 0, finished_at: new Date().toISOString() }).eq("id", id));
    },
    async ping() { const { error } = await sb.from("plan_limits").select("plan").limit(1); return !error; },
  };
}
