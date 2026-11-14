import { UnrecoverableError, type Job } from "bullmq";
import type { Logger } from "pino";
import { JOBS, isJobName, type JobName, type JobPayload } from "../../src/lib/queue/contracts";
import type { Db } from "./db";
import type { LlmProvider } from "../../src/lib/llm/provider";
import { LlmError } from "../../src/lib/llm/provider";
import { DNA_PROMPT_VERSION, extractObservations, type Observation } from "../../src/lib/dna/extract";
import { buildFindings } from "../../src/lib/dna/findings";
import { sleep } from "./runtime";

export type Ctx = { job: Job; signal: AbortSignal; log: Logger; db: Db; llm?: LlmProvider | null };

type Handlers = { [N in JobName]: (payload: JobPayload<N>, ctx: Ctx) => Promise<unknown> };

export const handlers: Handlers = {
  async selftest(p, { job, signal }) {
    if (p.mode === "fail_always") throw new Error("simulated permanent failure");
    if (p.mode === "fail_once" && job.attemptsMade === 0) throw new Error("simulated one-time failure");
    if (p.mode === "sleep") await sleep(p.sleepMs ?? 1000, signal);
    return { ok: true, attempt: job.attemptsMade + 1 };
  },

  async reapStuckJobs(p, { db, log }) {
    const rows = await db.reapStuckJobs(p.staleAfterSeconds, p.maxAttempts);
    for (const r of rows) {
      log.warn({ jobId: r.jobId, action: r.action }, "reaper: job lost its worker");
      await db.recordAudit({ action: "job.reaped", target: r.jobId, meta: { action: r.action } });
    }
    const stale = await db.staleQueuedJobs(3600);
    for (const r of stale) log.warn({ jobId: r.jobId }, "job has been queued for over an hour (queue entry may be lost)");
    return { reaped: rows.length, staleQueued: stale.length };
  },

  async cleanupStaleUploads(p, { db, log }) {
    const rows = await db.stalePendingAssets(p.olderThanMinutes, p.limit);
    if (rows.length === 0) return { removed: 0 };
    await db.removeStorage(rows.map((r) => r.storageKey)); // files first; if this throws, rows stay and we retry next run
    await db.deleteAssets(rows.map((r) => r.id));
    log.info({ removed: rows.length }, "removed abandoned uploads");
    return { removed: rows.length };
  },

  /** Idempotent: a run only claims an analysis that is still 'queued'. Transcript observations are cached, so adding one transcript costs one model call. */
  async analyzeDna(p, { db, llm, log, signal }) {
    const claim = await db.claimAnalysis(p.analysisId);
    if (!claim) return { skipped: true };
    try {
      if (!llm) throw new LlmError("not_configured", "AI analysis is not configured.", false);
      const transcripts = await db.loadDnaTranscripts(claim.collectionId, DNA_PROMPT_VERSION);
      if (transcripts.length === 0) throw new Error("No transcripts to analyze.");
      const byTranscript = new Map<string, Observation[]>();
      let model = "", fresh = 0, dropped = 0;
      for (const t of transcripts) {
        if (signal.aborted) throw new Error("Cancelled.");
        if (t.observations) { byTranscript.set(t.id, t.observations); continue; }
        const r = await extractObservations(llm, t.body);
        model = r.model; fresh++; dropped += r.dropped;
        await db.saveObservations({ userId: claim.userId, transcriptId: t.id, promptVersion: DNA_PROMPT_VERSION, observations: r.observations });
        byTranscript.set(t.id, r.observations);
      }
      const findings = buildFindings(transcripts.map((t) => ({ id: t.id, title: t.title, highPerformer: t.highPerformer })), byTranscript);
      await db.saveFindings({ userId: claim.userId, collectionId: claim.collectionId, findings });
      await db.finishAnalysis(p.analysisId, { status: "completed", model, transcriptCount: transcripts.length });
      log.info({ analysisId: p.analysisId, transcripts: transcripts.length, fresh, findings: findings.length, droppedObservations: dropped }, "dna analysis complete");
      return { transcripts: transcripts.length, fresh, findings: findings.length };
    } catch (e) {
      const msg = e instanceof LlmError ? e.message : e instanceof Error && e.message === "No transcripts to analyze." ? e.message : "The analysis could not be completed.";
      await db.finishAnalysis(p.analysisId, { status: "failed", error: msg });
      throw e;
    }
  },
};

/** Validate the payload again at the worker (Redis is a trust boundary), then dispatch. */
export async function dispatch(job: Job, ctx: Omit<Ctx, "job">) {
  if (!isJobName(job.name)) throw new UnrecoverableError(`Unknown job: ${job.name}`);
  const parsed = JOBS[job.name].schema.safeParse(job.data);
  if (!parsed.success) throw new UnrecoverableError("Invalid job payload");
  const h = handlers[job.name] as (p: unknown, c: Ctx) => Promise<unknown>;
  return h(parsed.data, { ...ctx, job });
}
