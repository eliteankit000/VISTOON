import { createClient } from "@supabase/supabase-js";

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
}

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
    async ping() { const { error } = await sb.from("plan_limits").select("plan").limit(1); return !error; },
  };
}
