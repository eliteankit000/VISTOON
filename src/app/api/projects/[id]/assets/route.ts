import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, dbError, jsonError, readJson, uuid } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { BUCKET, buildStorageKey, sanitizeName, validateUploadRequest } from "@/lib/uploads/rules";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data, error } = await supabase.from("assets")
    .select("id, kind, original_name, mime, bytes, status, archived_at, created_at").eq("project_id", id).order("created_at", { ascending: false });
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ assets: data });
}

const init = z.object({
  kind: z.enum(["voiceover", "reference"]),
  name: z.string().min(1).max(300),
  mime: z.string().min(3).max(100),
  bytes: z.number().int().positive(),
  rightsConfirmed: z.literal(true), // the user must confirm they hold the rights to what they upload
}).strict();

/** Step 1 of an upload: validate, reserve quota, hand back a short-lived signed upload token. */
export async function POST(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id: projectId } = await params;
  if (!uuid.safeParse(projectId).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);

  const body = await readJson(request, init);
  if (!body) return jsonError("Invalid request. Confirm you have the rights to this file.", 400);

  const { data: project } = await supabase.from("projects").select("id, archived_at").eq("id", projectId).maybeSingle();
  if (!project) return jsonError("Not found", 404);
  if (project.archived_at) return jsonError("This project is archived.", 409);

  const v = validateUploadRequest(body.kind, body.mime, body.bytes);
  if (!v.ok) return jsonError(v.error, 415);

  const svc = createServiceClient();
  const assetId = randomUUID();
  const path = buildStorageKey(user.id, projectId, assetId, v.mime);
  // Row first: the database trigger enforces the storage quota and pending-upload cap atomically.
  const { error: insErr } = await svc.from("assets").insert({
    id: assetId, user_id: user.id, project_id: projectId, kind: body.kind, storage_key: path,
    mime: v.mime, bytes: body.bytes, original_name: sanitizeName(body.name), status: "pending", rights_confirmed: true,
  });
  if (insErr) return dbError(insErr.message);

  const { data: signed, error: signErr } = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signErr || !signed) {
    await svc.from("assets").delete().eq("id", assetId);
    return jsonError("Could not start the upload.", 500);
  }
  return Response.json({ assetId, path: signed.path, token: signed.token, mime: v.mime }, { status: 201 });
}
