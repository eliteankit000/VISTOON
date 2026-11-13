import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, uuid } from "@/lib/api";
import { countWords, WORD_POLICY } from "@/lib/scripts/count";
import { getOrCreateScript, VERSION_COLUMNS } from "@/lib/scripts/store";

const schema = z.object({ body: z.string().max(60_000) }).strict();

/** Autosave: overwrites the single autosave slot for this script. It never creates history rows. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id: projectId } = await params;
  if (!uuid.safeParse(projectId).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const text = await request.text().catch(() => "");
  if (text.length > 200_000) return jsonError("Too large", 413);
  let parsed; try { parsed = schema.safeParse(JSON.parse(text)); } catch { return jsonError("Invalid request", 400); }
  if (!parsed.success) return jsonError("Invalid request", 400);

  const { data: project } = await supabase.from("projects").select("id, archived_at").eq("id", projectId).maybeSingle();
  if (!project) return jsonError("Not found", 404);
  if (project.archived_at) return jsonError("This project is archived.", 409);
  const scriptId = await getOrCreateScript(supabase, user.id, projectId);
  if (!scriptId) return jsonError("Could not save.", 500);

  const body = parsed.data.body;
  const upd = await supabase.from("script_versions").update({ body, actual_count: countWords(body), counter_policy: WORD_POLICY, count_type: "words" })
    .eq("script_id", scriptId).eq("kind", "autosave").select(VERSION_COLUMNS).maybeSingle();
  if (upd.error) return jsonError("Could not save.", 500);
  if (upd.data) return Response.json({ draft: upd.data });
  const ins = await supabase.from("script_versions").insert({ user_id: user.id, script_id: scriptId, body, kind: "autosave", count_type: "words", actual_count: countWords(body), counter_policy: WORD_POLICY }).select(VERSION_COLUMNS).single();
  if (ins.error) {
    if (ins.error.message.includes("script_versions_one_autosave")) { // two tabs raced: retry as an update
      const again = await supabase.from("script_versions").update({ body, actual_count: countWords(body) }).eq("script_id", scriptId).eq("kind", "autosave").select(VERSION_COLUMNS).maybeSingle();
      if (again.data) return Response.json({ draft: again.data });
    }
    return jsonError("Could not save.", 500);
  }
  return Response.json({ draft: ins.data }, { status: 201 });
}
