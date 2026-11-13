import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";
import { getLlm } from "@/lib/llm";
import { scoreScript } from "@/lib/scripts/quality";
import { llmFailure, reserveSlots } from "@/lib/scripts/guard";

const schema = z.object({ text: z.string().min(20).max(60_000), versionId: z.string().uuid().optional() }).strict();

/** Score a script out of 100 with per-dimension reasons. If versionId is given, the result is stored on that version. */
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

  let version: { id: string; body: string; scores: Record<string, unknown> | null } | null = null;
  if (b.versionId) {
    const { data: scripts } = await supabase.from("scripts").select("id").eq("project_id", projectId);
    const { data } = await supabase.from("script_versions").select("id, body, scores").eq("id", b.versionId).in("script_id", (scripts ?? []).map((s) => s.id)).maybeSingle();
    if (!data) return jsonError("Not found", 404);
    version = data; // the text that gets scored is the STORED text, so a stored score always matches its version
  }
  const text = version?.body ?? b.text;
  if (text.length < 20) return jsonError("Script is too short to score.", 400);

  const slots = await reserveSlots(user.id, 1);
  if (slots instanceof Response) return slots;
  try {
    const quality = await scoreScript(getLlm(), text);
    if (version) await supabase.from("script_versions").update({ scores: { ...(version.scores ?? {}), quality } }).eq("id", version.id);
    return Response.json({ quality });
  } catch (e) { await slots.release(); return llmFailure(e); }
}
