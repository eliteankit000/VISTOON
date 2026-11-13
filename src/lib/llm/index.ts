import "server-only";
import { anthropicProvider } from "./anthropic";
import { LlmError, type LlmProvider } from "./provider";

/** Server-only. The provider is chosen from environment config; the browser never sees keys or provider names. */
export function getLlm(): LlmProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LlmError("not_configured", "AI generation is not configured.", false);
  const timeoutMs = Math.min(Math.max(Number(process.env.LLM_TIMEOUT_MS) || 60_000, 5_000), 120_000);
  return anthropicProvider({ apiKey, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", timeoutMs });
}
