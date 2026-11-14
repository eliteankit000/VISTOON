import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };
const patch = z.object({ excluded: z.boolean().optional(), highPerformer: z.boolean().optional(), title: z.string().trim().min(1).max(200).optional() }).strict();

/** Exclude/include a transcript, mark it as a high performer, or rename it. Findings update on the next analysis. */
export async function PATCH(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const b = await readJson(request, patch);
  if (!b || Object.keys(b).length === 0) return jsonError("Invalid request", 400);
  const upd: Record<string, unknown> = {};
  if (b.excluded !== undefined) upd.excluded = b.excluded;
  if (b.highPerformer !== undefined) upd.high_performer = b.highPerformer;
  if (b.title !== undefined) upd.title = b.title;
  const { data, error } = await supabase.from("dna_transcripts").update(upd).eq("id", id).select("id").maybeSingle();
  if (error) return jsonError("Request failed.", 500);
  return data ? Response.json({ ok: true }) : jsonError("Not found", 404);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data, error } = await supabase.from("dna_transcripts").delete().eq("id", id).select("id").maybeSingle();
  if (error) return jsonError("Request failed.", 500);
  return data ? Response.json({ ok: true }) : jsonError("Not found", 404);
}
