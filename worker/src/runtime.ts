import { UnrecoverableError } from "bullmq";
import type { Redis } from "ioredis";
import { cancelKey } from "../../src/lib/queue/contracts";

export class TimeoutError extends Error { constructor(ms: number) { super(`Job exceeded its ${ms} ms time limit`); this.name = "TimeoutError"; } }
/** Cancellation is final: UnrecoverableError tells BullMQ not to retry. */
export class CancelledError extends UnrecoverableError { constructor() { super("Cancelled by user"); this.name = "CancelledError"; } }

/**
 * Runs `fn` with a hard time limit and a cancel flag. When either fires the AbortSignal is aborted
 * (so well-behaved work stops) and the job fails immediately.
 */
export async function runGuarded<T>(
  o: { redis: Redis; queue: string; jobId: string; timeoutMs: number; pollMs?: number },
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const ac = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  let poll: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { ac.abort(); reject(new TimeoutError(o.timeoutMs)); }, o.timeoutMs);
    poll = setInterval(() => {
      o.redis.get(cancelKey(o.queue, o.jobId)).then((v) => { if (v) { ac.abort(); reject(new CancelledError()); } }).catch(() => undefined);
    }, o.pollMs ?? 1000);
  });
  try { return await Promise.race([fn(ac.signal), guard]); }
  finally { clearTimeout(timer); clearInterval(poll); }
}

export const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason ?? new Error("aborted")); }, { once: true });
});
