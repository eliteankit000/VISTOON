import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, uuid } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { inspectObject, removeObjects, sniffMatches } from "@/lib/services/assets";

type Ctx = { params: Promise<{ id: string }> };

/** Step 2: verify what was actually stored (size, real file type, checksum) before the asset becomes usable. */
export async function POST(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);

  const { data: asset } = await supabase.from("assets").select("id, storage_key, mime, bytes, status").eq("id", id).maybeSingle();
  if (!asset) return jsonError("Not found", 404);
  if (asset.status !== "pending") return jsonError("Already completed.", 409);

  const svc = createServiceClient();
  const reject = async (msg: string, code: number) => {
    await removeObjects(svc, [asset.storage_key]);
    await svc.from("assets").delete().eq("id", id).eq("user_id", user.id);
    return jsonError(msg, code);
  };

  const info = await inspectObject(svc, asset.storage_key, Number(asset.bytes));
  if (!info.ok) return reject(info.reason === "too_large" ? "The uploaded file is larger than declared." : "The upload did not arrive. Please try again.", info.reason === "too_large" ? 413 : 400);
  if (!sniffMatches(asset.mime, info.sniffed)) return reject("The file content does not match its type.", 415);

  const { error } = await svc.from("assets").update({ status: "ready", bytes: info.size, sha256: info.sha256 }).eq("id", id).eq("user_id", user.id);
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ ok: true, bytes: info.size, sha256: info.sha256 });
}
