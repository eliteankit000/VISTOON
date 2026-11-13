import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";
import { getLlm } from "@/lib/llm";
import { rewriteSection } from "@/lib/scripts/revise";
import { llmFailure, reserveSlots } from "@/lib/scripts/guard";

const schema = z.object({
  text: z.string().min(20).max(60_000),
  start: z.number().int().min(0),
  end: z.number().int().min(1),
  instruction: z.string().trim().min(3).max(200),
}).strict().refine((b) => b.end > b.start && b.end <= b.text.length && b.end - b.start >= 5 && b.end - b.start <= 3000);

/** Rewrite one selected passage. Only that range can change; the result is returned, not saved. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id: projectId } = await params;
  if (!uuid.safeParse(projectId).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const b = await readJson(request, schema);
  if (!b) return jsonError("Select 5–3000 characters and give a short instruction.", 400);
  const { data: project } = await supabase.from("projects").select("id, archived_at").eq("id", projectId).maybeSingle();
  if (!project) return jsonError("Not found", 404);
  if (project.archived_at) return jsonError("This project is archived.", 409);
  const slots = await reserveSlots(user.id, 1);
  if (slots instanceof Response) return slots;
  try { return Response.json(await rewriteSection(getLlm(), b.text, b.start, b.end, b.instruction)); }
  catch (e) { await slots.release(); return llmFailure(e); }
}
