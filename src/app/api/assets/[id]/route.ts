import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { removeObjects } from "@/lib/services/assets";
import { BUCKET } from "@/lib/uploads/rules";

type Ctx = { params: Promise<{ id: string }> };

/** Short-lived (60 s) signed download link, issued only to the owner of a verified file. */
export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data: asset } = await supabase.from("assets").select("storage_key, original_name, status").eq("id", id).maybeSingle();
  if (!asset || asset.status !== "ready") return jsonError("Not found", 404);
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrl(asset.storage_key, 60, { download: asset.original_name ?? true });
  if (error || !data) return jsonError("Request failed.", 500);
  return Response.json({ url: data.signedUrl, expiresInSeconds: 60 });
}

const patch = z.object({ archived: z.boolean() }).strict();
export async function PATCH(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const body = await readJson(request, patch);
  if (!body) return jsonError("Invalid request", 400);
  const { data: asset } = await supabase.from("assets").select("id").eq("id", id).maybeSingle();
  if (!asset) return jsonError("Not found", 404);
  // Users have no UPDATE right on assets (rows are server-written), so this goes through the server after the ownership check above.
  const { error } = await createServiceClient().from("assets").update({ archived_at: body.archived ? new Date().toISOString() : null }).eq("id", id).eq("user_id", user.id);
  return error ? jsonError("Request failed.", 500) : Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data: asset } = await supabase.from("assets").select("storage_key").eq("id", id).maybeSingle();
  if (!asset) return jsonError("Not found", 404);
  const svc = createServiceClient();
  const removed = await removeObjects(svc, [asset.storage_key]);
  if (!removed.ok) return jsonError("Could not delete the stored file. Try again.", 500);
  const { error } = await svc.from("assets").delete().eq("id", id).eq("user_id", user.id);
  return error ? jsonError("Request failed.", 500) : Response.json({ ok: true });
}
