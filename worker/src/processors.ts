import { UnrecoverableError, type Job } from "bullmq";
import type { Logger } from "pino";
import { JOBS, isJobName, type JobName, type JobPayload } from "../../src/lib/queue/contracts";
import type { Db } from "./db";
import { sleep } from "./runtime";

export type Ctx = { job: Job; signal: AbortSignal; log: Logger; db: Db };

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
};

/** Validate the payload again at the worker (Redis is a trust boundary), then dispatch. */
export async function dispatch(job: Job, ctx: Omit<Ctx, "job">) {
  if (!isJobName(job.name)) throw new UnrecoverableError(`Unknown job: ${job.name}`);
  const parsed = JOBS[job.name].schema.safeParse(job.data);
  if (!parsed.success) throw new UnrecoverableError("Invalid job payload");
  const h = handlers[job.name] as (p: unknown, c: Ctx) => Promise<unknown>;
  return h(parsed.data, { ...ctx, job });
}
