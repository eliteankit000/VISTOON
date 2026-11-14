import { generateWithRetry, type RetryOptions } from "@/lib/llm/retry";
import type { LlmProvider } from "@/lib/llm/provider";
import { LlmError } from "@/lib/llm/provider";
import type { ProfileItem } from "@/lib/dna/profile";
import { countWords, WORD_POLICY } from "./count";
import { buildScriptPrompt, PROMPT_VERSION, type Brief } from "./prompts";

export type Generated = { body: string; words: number; policy: string; promptVersion: string; model: string; inputTokens: number; outputTokens: number };

/** Strip things models add despite instructions (code fences, "Script:" labels). The text is plain text and is escaped on render. */
export function tidy(raw: string): string {
  return raw.replace(/^```[a-z]*\n?|```$/gim, "").replace(/^\s*(script|voiceover)\s*:\s*/i, "").trim();
}

export async function generateScript(llm: LlmProvider, brief: Brief, retry?: RetryOptions, profile: ProfileItem[] = []): Promise<Generated> {
  const p = buildScriptPrompt(brief, profile);
  const r = await generateWithRetry(llm, { ...p, temperature: 0.8 }, retry);
  const body = tidy(r.text);
  if (body.length < 20) throw new LlmError("bad_response", "The AI provider returned an unusable script.", false);
  if (body.length > 60_000) throw new LlmError("bad_response", "The AI provider returned too much text.", false);
  return { body, words: countWords(body), policy: WORD_POLICY, promptVersion: PROMPT_VERSION, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
}
