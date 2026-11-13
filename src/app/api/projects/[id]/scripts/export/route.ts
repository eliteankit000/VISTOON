import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { jsonError, uuid } from "@/lib/api";
import { buildExport } from "@/lib/scripts/export";

const q = z.object({ versionId: z.string().uuid(), format: z.enum(["txt", "md", "json"]) });

/** Download a saved version. Plain-text types with nosniff and attachment disposition: the browser never renders or runs it. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  if (!uuid.safeParse(projectId).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const parsed = q.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError("Invalid request", 400);
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();
  if (!project) return jsonError("Not found", 404);
  const { data: scripts } = await supabase.from("scripts").select("id").eq("project_id", projectId);
  const { data: v } = await supabase.from("script_versions").select("id, body, kind, count_type, actual_count, counter_policy, revision_round, scores, created_at")
    .eq("id", parsed.data.versionId).in("script_id", (scripts ?? []).map((s) => s.id)).maybeSingle();
  if (!v) return jsonError("Not found", 404);
  const out = buildExport(project.name, v, parsed.data.format);
  return new Response(out.body, { headers: {
    "content-type": out.type, "content-disposition": `attachment; filename="${out.filename}"`,
    "x-content-type-options": "nosniff", "cache-control": "private, no-store",
  } });
}
