import { jsonError } from "@/lib/api";
import { LlmError } from "@/lib/llm/provider";
import { createServiceClient } from "@/lib/supabase/service";

/** Reserve `n` generation slots (daily cap + kill switch). Returns ids to release on failure, or a Response to return. */
export async function reserveSlots(userId: string, n: number): Promise<{ ids: number[]; release: () => Promise<void> } | Response> {
  const svc = createServiceClient();
  const ids: number[] = [];
  const release = async () => { if (ids.length) await svc.from("usage_events").delete().in("id", ids); };
  for (let i = 0; i < n; i++) {
    const { data, error } = await svc.rpc("reserve_script_generation", { uid: userId });
    if (error) {
      await release();
      if (error.message.includes("script_generation_disabled")) return jsonError("Script generation is temporarily paused.", 503);
      if (error.message.includes("generation_limit_reached")) return jsonError("Daily AI limit reached. Try again tomorrow.", 429);
      return jsonError("Request failed.", 500);
    }
    ids.push(data as number);
  }
  return { ids, release };
}
export function llmFailure(e: unknown): Response {
  if (e instanceof LlmError) {
    if (e.kind === "timeout") return jsonError("The AI provider took too long. Please try again.", 504);
    if (e.kind === "not_configured" || e.kind === "rate_limited") return jsonError("AI is not available right now. Please try again shortly.", 503);
    return jsonError("The AI provider could not complete this. Please try again.", 502);
  }
  return jsonError("Request failed.", 500);
}
