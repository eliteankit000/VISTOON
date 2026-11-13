/** Provider-agnostic LLM interface. Nothing outside src/lib/llm knows which vendor is behind it. */
export type LlmRequest = {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
};
export type LlmResult = { text: string; inputTokens: number; outputTokens: number; model: string; stopReason: string | null };

export type LlmErrorKind = "timeout" | "rate_limited" | "provider_error" | "bad_response" | "not_configured" | "rejected";
export class LlmError extends Error {
  constructor(public kind: LlmErrorKind, message: string, public retryable: boolean, public retryAfterMs?: number) {
    super(message);
    this.name = "LlmError";
  }
}
export interface LlmProvider {
  readonly name: string;
  generate(req: LlmRequest): Promise<LlmResult>;
}
