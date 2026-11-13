import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";
import { getLlm } from "@/lib/llm";
import { LlmError } from "@/lib/llm/provider";
import { fitToLength } from "@/lib/scripts/length";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z.object({
  text: z.string().min(5).max(60_000),
  targetType: z.enum(["words", "chars"]),
  targetCount: z.number().int().min(20).max(60_000),
}).strict().refine((b) => b.targetType !== "words" || b.targetCount <= 3000);

/** Adjust the editor text toward an exact length (up to 3 correction rounds). Not saved: the user chooses whether to keep it. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id: projectId } = await params;
  if (!uuid.safeParse(projectId).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const b = await readJson(request, schema);
  if (!b) return jsonError("Invalid request", 400);
  const { data: project } = await supabase.from("projects").select("id, archived_at").eq("id", projectId).maybeSingle();
  if (!project) return jsonError("Not found", 404);
  if (project.archived_at) return jsonError("This project is archived.", 409);

  const svc = createServiceClient();
  const { data: eventId, error: resErr } = await svc.rpc("reserve_script_generation", { uid: user.id });
  if (resErr) {
    if (resErr.message.includes("script_generation_disabled")) return jsonError("Script generation is temporarily paused.", 503);
    if (resErr.message.includes("generation_limit_reached")) return jsonError("Daily script generation limit reached. Try again tomorrow.", 429);
    return jsonError("Request failed.", 500);
  }
  try {
    const r = await fitToLength(getLlm(), b.text, b.targetType, b.targetCount);
    if (r.llmCalls === 0) await svc.from("usage_events").delete().eq("id", eventId as number);
    return Response.json({ result: r });
  } catch (e) {
    await svc.from("usage_events").delete().eq("id", eventId as number);
    if (e instanceof LlmError && e.kind === "timeout") return jsonError("The AI provider took too long. Please try again.", 504);
    if (e instanceof LlmError && (e.kind === "not_configured" || e.kind === "rate_limited")) return jsonError("AI generation is not available right now.", 503);
    return jsonError("The AI provider could not adjust the script. Please try again.", 502);
  }
}
