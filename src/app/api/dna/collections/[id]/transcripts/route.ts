import { createHash } from "node:crypto";
import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, uuid } from "@/lib/api";
import { countWords } from "@/lib/scripts/count";
import { cleanTranscript, detectLanguage } from "@/lib/dna/clean";
import { flagEnabled } from "@/lib/flags";

const schema = z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(400_000), highPerformer: z.boolean().optional() }).strict();

/** Paste or upload (the browser reads the file; the server only ever sees text). Transcripts are added one at a time. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  if (!(await flagEnabled(supabase, "dna_analyzer"))) return jsonError("The DNA Analyzer is currently unavailable.", 503);
  const raw = await request.text().catch(() => "");
  if (raw.length > 500_000) return jsonError("Transcript is too large.", 413);
  let parsed; try { parsed = schema.safeParse(JSON.parse(raw)); } catch { return jsonError("Invalid request", 400); }
  if (!parsed.success) return jsonError("Invalid request", 400);

  const text = cleanTranscript(parsed.data.body);
  if (text.length < 50) return jsonError("The transcript is too short (at least 50 characters).", 400);
  if (text.length > 100_000) return jsonError("The transcript is too long (100,000 characters maximum).", 413);

  const { data: c } = await supabase.from("dna_collections").select("id").eq("id", id).maybeSingle();
  if (!c) return jsonError("Not found", 404);
  const { data, error } = await supabase.from("dna_transcripts").insert({
    user_id: user.id, collection_id: id, title: parsed.data.title, body: text, language: detectLanguage(text), word_count: countWords(text),
    high_performer: parsed.data.highPerformer ?? false, body_sha256: createHash("sha256").update(text).digest("hex"),
  }).select("id, title, language, word_count, excluded, high_performer, created_at").single();
  if (error) {
    if (error.message.includes("transcript_limit_reached")) return jsonError("This collection already has 30 transcripts.", 409);
    if (error.message.includes("no_dupes")) return jsonError("This transcript is already in the collection.", 409);
    return jsonError("Request failed.", 500);
  }
  return Response.json({ transcript: data }, { status: 201 });
}
