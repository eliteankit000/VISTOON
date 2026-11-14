import { z } from "zod";

export const QUEUES = { system: "vistoon-system", render: "vistoon-render", deadLetter: "vistoon-dead-letter" } as const;

/** Every job the platform can run: its queue, validated payload, hard timeout and retry cap. */
export const JOBS = {
  // Infrastructure self-test (admin-only). Not a render.
  selftest: {
    queue: QUEUES.system, timeoutMs: 30_000, attempts: 3,
    schema: z.object({ mode: z.enum(["ok", "fail_once", "fail_always", "sleep"]), sleepMs: z.number().int().min(0).max(120_000).optional() }).strict(),
  },
  // Finds render jobs whose worker vanished (no heartbeat) and re-queues or fails them.
  reapStuckJobs: {
    queue: QUEUES.system, timeoutMs: 30_000, attempts: 1,
    schema: z.object({ staleAfterSeconds: z.number().int().min(30).max(86_400), maxAttempts: z.number().int().min(1).max(10) }).strict(),
  },
  // Deletes uploads that were reserved but never completed (and their stored bytes).
  cleanupStaleUploads: {
    queue: QUEUES.system, timeoutMs: 120_000, attempts: 1,
    schema: z.object({ olderThanMinutes: z.number().int().min(15).max(10_080), limit: z.number().int().min(1).max(500) }).strict(),
  },
  // DNA Analyzer: extracts techniques from each new transcript (cached), then rebuilds the collection's findings.
  analyzeDna: {
    queue: QUEUES.system, timeoutMs: 20 * 60_000, attempts: 1,
    schema: z.object({ analysisId: z.string().uuid() }).strict(),
  },
} as const;

export type JobName = keyof typeof JOBS;
export type JobPayload<N extends JobName> = z.infer<(typeof JOBS)[N]["schema"]>;
export const isJobName = (n: string): n is JobName => Object.prototype.hasOwnProperty.call(JOBS, n);

/** BullMQ job ids: no ':' and not purely numeric. We also forbid anything unusual. */
export const JOB_ID = /^(?!\d+$)[A-Za-z0-9_-]{1,128}$/;
export const cancelKey = (queue: string, jobId: string) => `vistoon:cancel:${queue}:${jobId}`;
