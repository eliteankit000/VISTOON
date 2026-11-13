import { LlmError, type LlmProvider, type LlmRequest, type LlmResult } from "./provider";

export type RetryOptions = { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; sleep?: (ms: number) => Promise<void> };

/** Bounded retries (default 3 attempts) with exponential backoff; only errors marked retryable are retried. */
export async function generateWithRetry(p: LlmProvider, req: LlmRequest, o: RetryOptions = {}): Promise<LlmResult> {
  const max = Math.min(o.maxAttempts ?? 3, 5), base = o.baseDelayMs ?? 500, cap = o.maxDelayMs ?? 8000;
  const sleep = o.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try { return await p.generate(req); } catch (e) {
      last = e;
      if (!(e instanceof LlmError) || !e.retryable || attempt === max || req.signal?.aborted) throw e;
      await sleep(Math.min(cap, e.retryAfterMs ?? base * 2 ** (attempt - 1)));
    }
  }
  throw last;
}
