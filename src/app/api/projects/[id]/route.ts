import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, dbError, jsonError, readJson, uuid } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { removeObjects } from "@/lib/services/assets";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle(); // RLS: only the owner's row is visible
  return data ? Response.json({ project: data }) : jsonError("Not found", 404);
}

const patch = z.object({ name: z.string().trim().min(1).max(120).optional(), archived: z.boolean().optional() }).strict();

export async function PATCH(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const body = await readJson(request, patch);
  if (!body || (body.name === undefined && body.archived === undefined)) return jsonError("Invalid request", 400);
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.archived !== undefined) update.archived_at = body.archived ? new Date().toISOString() : null;
  const { data, error } = await supabase.from("projects").update(update).eq("id", id).select("id").maybeSingle();
  if (error) return dbError(error.message);
  return data ? Response.json({ ok: true }) : jsonError("Not found", 404);
}

/** Hard delete: stored files first (only the server can), then the rows (cascade). */
export async function DELETE(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data: project } = await supabase.from("projects").select("id").eq("id", id).maybeSingle();
  if (!project) return jsonError("Not found", 404); // not yours or does not exist: same answer
  const { data: assets } = await supabase.from("assets").select("storage_key").eq("project_id", id);
  const svc = createServiceClient();
  const removed = await removeObjects(svc, (assets ?? []).map((a) => a.storage_key));
  if (!removed.ok) return jsonError("Could not delete stored files. Nothing was deleted; try again.", 500);
  const { error } = await svc.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ ok: true });
}
