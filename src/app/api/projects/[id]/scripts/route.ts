import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";
import { getLlm } from "@/lib/llm";
import { LlmError } from "@/lib/llm/provider";
import { countBy, policyFor, WORD_POLICY } from "@/lib/scripts/count";
import { profileFromFindings, type ProfileItem } from "@/lib/dna/profile";
import { generateScript } from "@/lib/scripts/generate";
import { fitToLength } from "@/lib/scripts/length";
import { briefSchema } from "@/lib/scripts/prompts";
import { createServiceClient } from "@/lib/supabase/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data: scripts } = await supabase.from("scripts").select("id").eq("project_id", id);
  const ids = (scripts ?? []).map((s) => s.id);
  if (ids.length === 0) return Response.json({ versions: [] });
  const { data, error } = await supabase.from("script_versions")
    .select("id, script_id, body, kind, count_type, target_count, actual_count, counter_policy, scores, created_at, updated_at").in("script_id", ids).order("created_at", { ascending: false }).limit(50);
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ versions: data });
}

const LLM_STATUS: Record<string, [string, number]> = {
  not_configured: ["AI generation is not available right now.", 503],
  timeout: ["The AI provider took too long. Please try again.", 504],
  rate_limited: ["The AI provider is busy. Please try again shortly.", 503],
};

/** Generate a script from a brief and save it as a new version. The quota slot is reserved first and released on failure. */
export async function POST(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id: projectId } = await params;
  if (!uuid.safeParse(projectId).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);

  const brief = await readJson(request, briefSchema);
  if (!brief) return jsonError("Invalid brief. Check the topic, language and format.", 400);

  const { data: project } = await supabase.from("projects").select("id, archived_at").eq("id", projectId).maybeSingle();
  if (!project) return jsonError("Not found", 404);
  if (project.archived_at) return jsonError("This project is archived.", 409);

  // Optional DNA profile: loaded with the user's own session, so only their own vetted findings can ever be used.
  let profile: ProfileItem[] = [];
  if (brief.dnaCollectionId) {
    const { data: col } = await supabase.from("dna_collections").select("id").eq("id", brief.dnaCollectionId).maybeSingle();
    if (!col) return jsonError("DNA collection not found.", 404);
    const { data: fs } = await supabase.from("dna_findings").select("technique, label, explanation, status").eq("collection_id", col.id);
    profile = profileFromFindings(fs ?? []);
  }

  const svc = createServiceClient();
  const { data: eventId, error: resErr } = await svc.rpc("reserve_script_generation", { uid: user.id });
  if (resErr) {
    if (resErr.message.includes("script_generation_disabled")) return jsonError("Script generation is temporarily paused.", 503);
    if (resErr.message.includes("generation_limit_reached")) return jsonError("Daily script generation limit reached. Try again tomorrow.", 429);
    return jsonError("Request failed.", 500);
  }
  const release = () => svc.from("usage_events").delete().eq("id", eventId as number);

  let out;
  let fit: Awaited<ReturnType<typeof fitToLength>> | null = null;
  try {
    const llm = getLlm();
    out = await generateScript(llm, brief, undefined, profile);
    if (brief.targetType && brief.targetCount) fit = await fitToLength(llm, out.body, brief.targetType, brief.targetCount);
  } catch (e) {
    await release();
    if (e instanceof LlmError) { const m = LLM_STATUS[e.kind]; return m ? jsonError(m[0], m[1]) : jsonError("The AI provider could not produce a script. Please try again.", 502); }
    return jsonError("Request failed.", 500);
  }

  // Saved with the user's own session, so row-level security applies to the writes.
  let { data: script } = await supabase.from("scripts").select("id").eq("project_id", projectId).order("created_at").limit(1).maybeSingle();
  if (!script) {
    const ins = await supabase.from("scripts").insert({ user_id: user.id, project_id: projectId }).select("id").single();
    script = ins.data;
  }
  if (!script) return jsonError("Could not save the script.", 500); // quota slot stays used: the provider call was made and billed
  const body = fit?.body ?? out.body;
  const type = brief.targetType ?? "words";
  const { data: version, error: vErr } = await supabase.from("script_versions").insert({
    user_id: user.id, script_id: script.id, body, kind: "generated", count_type: type, target_count: brief.targetCount ?? null,
    actual_count: countBy(type, body), counter_policy: brief.targetType ? policyFor(type) : WORD_POLICY,
    scores: { generation: { promptVersion: out.promptVersion, model: out.model, inputTokens: out.inputTokens, outputTokens: out.outputTokens, dnaTechniques: profile.map((p) => p.technique) }, ...(fit ? { length: { exact: fit.exact, rounds: fit.rounds, llmCalls: fit.llmCalls } } : {}) },
  }).select("id, script_id, body, kind, count_type, target_count, actual_count, counter_policy, scores, created_at, updated_at").single();
  if (vErr || !version) return jsonError("Could not save the script.", 500);
  return Response.json({ version, lengthExact: fit ? fit.exact : null }, { status: 201 });
}
