import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { JOBS, JOB_ID, QUEUES, cancelKey, type JobName, type JobPayload } from "./contracts";

export type EnqueueOptions = { jobId?: string; delayMs?: number; attempts?: number; backoffMs?: number };

/**
 * Producer side of the queue. Used by the web app (and tests). Payloads are validated BEFORE they reach Redis, and
 * `jobId` makes enqueueing idempotent: adding the same id twice never creates a second job.
 */
export function createProducer(redisUrl: string, prefix = "bull") {
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queues = new Map<string, Queue>();
  const q = (name: string) => {
    let x = queues.get(name);
    if (!x) { x = new Queue(name, { connection: redis, prefix }); queues.set(name, x); }
    return x;
  };

  return {
    redis,
    async enqueue<N extends JobName>(name: N, payload: JobPayload<N>, opts: EnqueueOptions = {}) {
      const def = JOBS[name];
      const data = def.schema.parse(payload); // throws ZodError on bad input
      const jobId = opts.jobId ?? randomUUID();
      if (!JOB_ID.test(jobId)) throw new Error("Invalid job id");
      const job = await q(def.queue).add(name, data, {
        jobId,
        delay: opts.delayMs,
        attempts: opts.attempts ?? def.attempts,
        backoff: { type: "exponential", delay: opts.backoffMs ?? 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 86400, count: 5000 }, // failures stay inspectable for a week
      });
      return { jobId: job.id as string, queue: def.queue };
    },
    /** Waiting/delayed jobs are removed at once; running jobs are told to stop (the worker polls this flag). */
    async requestCancel(queue: string, jobId: string) {
      if (!JOB_ID.test(jobId)) throw new Error("Invalid job id");
      await redis.set(cancelKey(queue, jobId), "1", "EX", 86_400);
      const job = await q(queue).getJob(jobId);
      if (!job) return { found: false as const };
      const state = await job.getState();
      if (state === "waiting" || state === "delayed" || state === "prioritized") { await job.remove().catch(() => undefined); return { found: true as const, state, removed: true }; }
      return { found: true as const, state, removed: false };
    },
    async stats() {
      const out: Record<string, Record<string, number>> = {};
      for (const name of Object.values(QUEUES)) out[name] = await q(name).getJobCounts("waiting", "active", "delayed", "failed", "completed");
      return out;
    },
    getQueue: q,
    async close() { await Promise.all([...queues.values()].map((x) => x.close())); redis.disconnect(); },
  };
}

let singleton: ReturnType<typeof createProducer> | null = null;
/** Lazy shared producer for the Next.js server. Throws if REDIS_URL is not configured. */
export function getProducer() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not configured");
  return (singleton ??= createProducer(url));
}
