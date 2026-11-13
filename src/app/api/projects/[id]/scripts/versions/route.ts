import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";
import { countBy, policyFor, WORD_POLICY } from "@/lib/scripts/count";
import { getOrCreateScript, VERSION_COLUMNS } from "@/lib/scripts/store";

const schema = z.object({
  body: z.string().min(1).max(60_000),
  targetType: z.enum(["words", "chars"]).optional(),
  targetCount: z.number().int().min(1).max(200_000).optional(),
}).strict().refine((b) => (b.targetType === undefined) === (b.targetCount === undefined));

/** Manual "Save version": a permanent history entry. Counts are computed here, never taken from the client. */
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
  const scriptId = await getOrCreateScript(supabase, user.id, projectId);
  if (!scriptId) return jsonError("Could not save.", 500);

  const type = b.targetType ?? "words";
  const { data, error } = await supabase.from("script_versions").insert({
    user_id: user.id, script_id: scriptId, body: b.body, kind: "edit", count_type: type, target_count: b.targetCount ?? null,
    actual_count: countBy(type, b.body), counter_policy: b.targetType ? policyFor(type) : WORD_POLICY,
  }).select(VERSION_COLUMNS).single();
  if (error) return error.message.includes("version_limit_reached") ? jsonError("Version history is full (200). Delete old versions first.", 409) : jsonError("Could not save.", 500);
  return Response.json({ version: data }, { status: 201 });
}
