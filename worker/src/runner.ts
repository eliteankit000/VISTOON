import { Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Logger } from "pino";
import { JOBS, QUEUES, isJobName, type JobName } from "../../src/lib/queue/contracts";
import type { Db } from "./db";
import { dispatch } from "./processors";
import { runGuarded } from "./runtime";

export type RunnerOptions = {
  redisUrl: string; db: Db; log: Logger; workerId: string;
  prefix?: string; concurrency?: number;
  lockDurationMs?: number; stalledIntervalMs?: number; maxStalledCount?: number;
  cancelPollMs?: number; statusIntervalMs?: number; schedules?: boolean;
  timeoutMs?: Partial<Record<JobName, number>>;            // overrides, mainly for tests
  reportError?: (err: Error, ctx: Record<string, unknown>) => void; // hook for an error tracker (e.g. Sentry)
};

export async function startWorkers(o: RunnerOptions) {
  const prefix = o.prefix ?? "bull";
  const redis = new Redis(o.redisUrl, { maxRetriesPerRequest: null });
  const dlq = new Queue(QUEUES.deadLetter, { connection: redis, prefix });
  const systemQueue = new Queue(QUEUES.system, { connection: redis, prefix });
  const startedAt = new Date().toISOString();
  const report = o.reportError ?? ((err, ctx) => o.log.error({ err, ...ctx }, "error captured"));
  let running = true;

  const processor = (queue: string) => async (job: Job) => {
    const name = job.name;
    const timeoutMs = (isJobName(name) ? o.timeoutMs?.[name] ?? JOBS[name].timeoutMs : 30_000);
    const log = o.log.child({ jobId: job.id, job: name, attempt: job.attemptsMade + 1 });
    const t0 = Date.now();
    log.info("job started");
    const result = await runGuarded({ redis, queue, jobId: job.id as string, timeoutMs, pollMs: o.cancelPollMs }, (signal) => dispatch(job, { signal, log, db: o.db }));
    log.info({ ms: Date.now() - t0 }, "job completed");
    return result;
  };

  const worker = new Worker(QUEUES.system, processor(QUEUES.system), {
    connection: redis, prefix, concurrency: o.concurrency ?? 2,
    lockDuration: o.lockDurationMs ?? 30_000, stalledInterval: o.stalledIntervalMs ?? 30_000, maxStalledCount: o.maxStalledCount ?? 1,
  });

  async function onFailed(job: Job | undefined, err: Error) {
    if (!job) { report(err, { event: "failed-without-job" }); return; }
    const state = await job.getState().catch(() => "unknown");
    const final = state === "failed" || err instanceof UnrecoverableError;
    o.log.warn({ jobId: job.id, job: job.name, attemptsMade: job.attemptsMade, final, reason: err.message }, final ? "job failed permanently" : "job failed, will retry");
    if (!final) return;
    // Dead-letter record (ids and reason only, never the payload) + audit entry + error tracker.
    await dlq.add("dead", { queue: job.queueName, job: job.name, jobId: job.id, attemptsMade: job.attemptsMade, reason: err.message.slice(0, 500) },
      { jobId: `dlq-${job.id}`, removeOnComplete: false, removeOnFail: false }).catch((e) => o.log.error({ err: e }, "dead-letter add failed"));
    await o.db.recordAudit({ action: "job.dead_lettered", target: String(job.id), meta: { job: job.name, attemptsMade: job.attemptsMade, reason: err.message.slice(0, 200) } })
      .catch((e) => o.log.error({ err: e }, "audit write failed"));
    report(err, { jobId: job.id, job: job.name, attemptsMade: job.attemptsMade });
  }
  worker.on("failed", (job, err) => { void onFailed(job, err); });
  worker.on("stalled", (jobId) => o.log.warn({ jobId }, "job stalled: its worker stopped renewing the lock"));
  worker.on("error", (err) => o.log.error({ err }, "worker error"));

  // Liveness record for monitoring: a worker that stops reporting is visible in worker_status.last_seen.
  const writeStatus = () => o.db.upsertWorkerStatus({ workerId: o.workerId, startedAt, info: { queues: [QUEUES.system], concurrency: o.concurrency ?? 2 } })
    .catch((e) => o.log.error({ err: e }, "worker status write failed"));
  void writeStatus();
  const statusTimer = (o.statusIntervalMs ?? 15_000) > 0 ? setInterval(() => void writeStatus(), o.statusIntervalMs ?? 15_000) : undefined;

  if (o.schedules) {
    const keep = { removeOnComplete: { age: 3600, count: 100 }, removeOnFail: { age: 86400, count: 100 } };
    await systemQueue.upsertJobScheduler("reap-stuck-jobs", { every: 60_000 }, { name: "reapStuckJobs", data: { staleAfterSeconds: 300, maxAttempts: 3 }, opts: { attempts: 1, ...keep } });
    await systemQueue.upsertJobScheduler("cleanup-stale-uploads", { every: 15 * 60_000 }, { name: "cleanupStaleUploads", data: { olderThanMinutes: 60, limit: 200 }, opts: { attempts: 1, ...keep } });
  }

  await worker.waitUntilReady();
  o.log.info({ workerId: o.workerId }, "worker ready");

  return {
    redis, worker,
    ready: () => running && redis.status === "ready" && worker.isRunning(),
    async close() {
      running = false;
      clearInterval(statusTimer);
      await worker.close(); // waits for jobs in progress
      await Promise.all([dlq.close(), systemQueue.close()]);
      redis.disconnect();
    },
  };
}
