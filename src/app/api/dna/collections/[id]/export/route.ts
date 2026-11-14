import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { jsonError, uuid } from "@/lib/api";
import { buildDnaExport } from "@/lib/dna/export";

const q = z.object({ format: z.enum(["json", "markdown"]), includeRejected: z.enum(["0", "1"]).optional() });

/** Evidence-preserving export. Source transcript text is never included. Download-only, plain-text types, nosniff. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const parsed = q.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return jsonError("Invalid request", 400);
  const { data: c } = await supabase.from("dna_collections").select("id, name, description").eq("id", id).maybeSingle();
  if (!c) return jsonError("Not found", 404);
  const [t, f, a] = await Promise.all([
    supabase.from("dna_transcripts").select("title, language, word_count, excluded, high_performer").eq("collection_id", id).order("created_at"),
    supabase.from("dna_findings").select("technique, technique_key, label, explanation, confidence, sample_count, status, evidence, counterexamples, updated_at").eq("collection_id", id).order("sample_count", { ascending: false }),
    supabase.from("dna_analyses").select("finished_at").eq("collection_id", id).eq("status", "completed").order("created_at", { ascending: false }).limit(1),
  ]);
  if (t.error || f.error || a.error) return jsonError("Request failed.", 500);
  const out = buildDnaExport({ name: c.name, description: c.description, transcripts: t.data, findings: f.data, analyzedAt: a.data[0]?.finished_at ?? null, includeRejected: parsed.data.includeRejected === "1" }, parsed.data.format);
  return new Response(out.body, { headers: { "content-type": out.type, "content-disposition": `attachment; filename="${out.filename}"`, "x-content-type-options": "nosniff", "cache-control": "private, no-store" } });
}
