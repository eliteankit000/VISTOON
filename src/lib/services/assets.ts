import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET, sniffMatches, sniffMime } from "@/lib/uploads/rules";

/**
 * Streams the stored object through a short-lived signed URL, computing size and SHA-256 and capturing the
 * first bytes for signature sniffing. Aborts as soon as the object exceeds `maxBytes`.
 */
export async function inspectObject(svc: SupabaseClient, path: string, maxBytes: number) {
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) return { ok: false as const, reason: "missing" };
  const res = await fetch(data.signedUrl);
  if (!res.ok || !res.body) return { ok: false as const, reason: "missing" };
  const hash = createHash("sha256");
  const reader = res.body.getReader();
  let size = 0;
  let head = new Uint8Array(0);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); return { ok: false as const, reason: "too_large" }; }
    if (head.length < 32) { const merged = new Uint8Array(head.length + value.length); merged.set(head); merged.set(value, head.length); head = merged.slice(0, 32); }
    hash.update(value);
  }
  return { ok: true as const, size, sha256: hash.digest("hex"), sniffed: sniffMime(head) };
}

export { sniffMatches };

export async function removeObjects(svc: SupabaseClient, paths: string[]) {
  if (paths.length === 0) return { ok: true };
  const { error } = await svc.storage.from(BUCKET).remove(paths);
  return { ok: !error };
}
