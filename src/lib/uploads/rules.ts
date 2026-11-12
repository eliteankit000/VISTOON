// Pure upload rules (no framework imports) so they can be unit-tested. Used by the upload API.
export const BUCKET = "vistoon-private";
export const MB = 1024 * 1024;

export type UploadKind = "voiceover" | "reference";

const EXT: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a",
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm",
};
// Browsers report the same file under several names; map them to the canonical type we store.
const ALIASES: Record<string, string> = {
  "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav",
  "audio/x-m4a": "audio/mp4", "audio/m4a": "audio/mp4", "image/jpg": "image/jpeg",
};
const ALLOWED: Record<UploadKind, { mimes: string[]; maxBytes: (mime: string) => number }> = {
  voiceover: { mimes: ["audio/mpeg", "audio/wav", "audio/mp4"], maxBytes: () => 50 * MB },
  reference: {
    mimes: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"],
    maxBytes: (m) => (m.startsWith("image/") ? 10 * MB : 50 * MB),
  },
};

export function normalizeMime(declared: string): string | null {
  const m = declared.trim().toLowerCase().split(";")[0]!.trim();
  const canon = ALIASES[m] ?? m;
  return EXT[canon] ? canon : null;
}

export type Validation = { ok: true; mime: string; maxBytes: number } | { ok: false; error: string };
export function validateUploadRequest(kind: UploadKind, declaredMime: string, bytes: number): Validation {
  const mime = normalizeMime(declaredMime);
  if (!mime || !ALLOWED[kind].mimes.includes(mime)) return { ok: false, error: "This file type is not allowed here." };
  const maxBytes = ALLOWED[kind].maxBytes(mime);
  if (!Number.isInteger(bytes) || bytes <= 0) return { ok: false, error: "The file is empty." };
  if (bytes > maxBytes) return { ok: false, error: `File too large. Maximum is ${Math.round(maxBytes / MB)} MB for this type.` };
  return { ok: true, mime, maxBytes };
}

const ascii = (b: Uint8Array, at: number, s: string) => s.split("").every((c, i) => b[at + i] === c.charCodeAt(0));

/** Identify a file from its first bytes (never trust the browser-declared type). */
export function sniffMime(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return "audio/wav";
  if (ascii(b, 0, "ID3") || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return "audio/mpeg";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (ascii(b, 4, "ftyp")) return "mp4-family"; // audio/mp4 and video/mp4 share the container
  return null;
}
/** Does what the bytes say match what we expected? */
export function sniffMatches(expected: string, sniffed: string | null): boolean {
  if (!sniffed) return false;
  if (sniffed === "mp4-family") return expected === "audio/mp4" || expected === "video/mp4";
  return sniffed === expected;
}

/** Display name only. Never used in the storage key or any path. */
export function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
  return clean || "file";
}

/** "<userId>/<projectId>/<assetId>.<ext>": all server-generated, so no user text reaches the path. */
export function buildStorageKey(userId: string, projectId: string, assetId: string, mime: string): string {
  const ext = EXT[mime];
  if (!ext) throw new Error("Unsupported mime");
  return `${userId}/${projectId}/${assetId}.${ext}`;
}
