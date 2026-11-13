import { LlmError, type LlmProvider, type LlmRequest, type LlmResult } from "./provider";

type Opts = { apiKey: string; model: string; timeoutMs: number; baseUrl?: string; fetchImpl?: typeof fetch };

/** Anthropic Messages API over fetch (no SDK). The key stays on the server and is never put in logs or errors. */
export function anthropicProvider(o: Opts): LlmProvider {
  const f = o.fetchImpl ?? fetch;
  return {
    name: "anthropic",
    async generate(req: LlmRequest): Promise<LlmResult> {
      const timeout = AbortSignal.timeout(o.timeoutMs);
      const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await f(`${o.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
          method: "POST", signal,
          headers: { "x-api-key": o.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: o.model, max_tokens: req.maxTokens, temperature: req.temperature ?? 0.8, system: req.system, messages: [{ role: "user", content: req.user }] }),
        });
      } catch (e) {
        if (timeout.aborted) throw new LlmError("timeout", "The AI provider took too long.", true);
        if (req.signal?.aborted) throw new LlmError("rejected", "Cancelled.", false);
        throw new LlmError("provider_error", "Could not reach the AI provider.", true);
      }
      if (res.status === 429 || res.status === 529) {
        const ra = Number(res.headers.get("retry-after"));
        throw new LlmError("rate_limited", "The AI provider is busy.", true, Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined);
      }
      if (res.status >= 500) throw new LlmError("provider_error", "The AI provider had an error.", true);
      if (!res.ok) throw new LlmError("rejected", `The AI provider rejected the request (${res.status}).`, false);
      const j = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; model?: string; stop_reason?: string } | null;
      const text = j?.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
      if (!j || !text.trim()) throw new LlmError("bad_response", "The AI provider returned no text.", true);
      return { text, inputTokens: j.usage?.input_tokens ?? 0, outputTokens: j.usage?.output_tokens ?? 0, model: j.model ?? o.model, stopReason: j.stop_reason ?? null };
    },
  };
}
