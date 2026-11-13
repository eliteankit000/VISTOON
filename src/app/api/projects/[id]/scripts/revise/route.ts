import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";
import { getLlm } from "@/lib/llm";
import { MAX_REVISION_ROUNDS, scoreScript, type Quality } from "@/lib/scripts/quality";
import { reviseOnce } from "@/lib/scripts/revise";
import { llmFailure, reserveSlots } from "@/lib/scripts/guard";
import { VERSION_COLUMNS } from "@/lib/scripts/store";
import type { CountType } from "@/lib/scripts/count";

const schema = z.object({ versionId: z.string().uuid() }).strict();

/** One revision round on a SAVED version. The round limit is checked here and enforced again by a database constraint. */
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

  const { data: scripts } = await supabase.from("scripts").select("id").eq("project_id", projectId);
  const { data: parent } = await supabase.from("script_versions").select("id, script_id, body, kind, count_type, target_count, revision_round, scores")
    .eq("id", b.versionId).in("script_id", (scripts ?? []).map((s) => s.id)).maybeSingle();
  if (!parent || parent.kind === "autosave") return jsonError("Not found", 404);
  if (parent.revision_round >= MAX_REVISION_ROUNDS) return jsonError(`Revision limit reached (${MAX_REVISION_ROUNDS} rounds). Edit by hand and save a new version to continue.`, 409);

  const slots = await reserveSlots(user.id, 2); // a revision round costs two slots (revise + re-score, plus length fitting)
  if (slots instanceof Response) return slots;
  try {
    const llm = getLlm();
    const stored = (parent.scores as { quality?: Quality } | null)?.quality;
    const before = stored ?? (await scoreScript(llm, parent.body));
    const target = parent.target_count && parent.count_type ? { type: parent.count_type as CountType, count: parent.target_count } : null;
    const rev = await reviseOnce(llm, parent.body, before, target);
    const { data: version, error } = await supabase.from("script_versions").insert({
      user_id: user.id, script_id: parent.script_id, body: rev.body, kind: "revision", parent_id: parent.id, revision_round: parent.revision_round + 1,
      count_type: parent.count_type, target_count: parent.target_count, actual_count: rev.fit?.actual ?? rev.quality.metrics.words,
      counter_policy: rev.fit?.policy ?? "words-v1", scores: { quality: rev.quality, previousTotal: before.total, ...(rev.fit ? { length: { exact: rev.fit.exact, rounds: rev.fit.rounds } } : {}) },
    }).select(VERSION_COLUMNS).single();
    if (error || !version) { await slots.release(); return jsonError("Could not save the revision.", 500); }
    return Response.json({ version, previousTotal: before.total, improved: rev.quality.total > before.total, roundsLeft: MAX_REVISION_ROUNDS - version.revision_round }, { status: 201 });
  } catch (e) { await slots.release(); return llmFailure(e); }
}
