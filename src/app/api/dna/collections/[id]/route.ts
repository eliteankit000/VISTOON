import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Collection with transcript metadata (never bodies), findings with their evidence, and the latest analysis run. */
export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data: collection } = await supabase.from("dna_collections").select("id, name, description, created_at, updated_at").eq("id", id).maybeSingle();
  if (!collection) return jsonError("Not found", 404); // RLS: another user's collection looks identical to a missing one
  const [t, f, a] = await Promise.all([
    supabase.from("dna_transcripts").select("id, title, language, word_count, excluded, high_performer, created_at").eq("collection_id", id).order("created_at"),
    supabase.from("dna_findings").select("id, technique_key, technique, label, explanation, confidence, sample_count, evidence, counterexamples, status, updated_at").eq("collection_id", id).order("sample_count", { ascending: false }),
    supabase.from("dna_analyses").select("id, status, error, transcript_count, created_at, finished_at").eq("collection_id", id).order("created_at", { ascending: false }).limit(1),
  ]);
  if (t.error || f.error || a.error) return jsonError("Request failed.", 500);
  return Response.json({ collection, transcripts: t.data, findings: f.data, analysis: a.data[0] ?? null });
}

const patch = z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(500).nullable().optional() }).strict();
export async function PATCH(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const b = await readJson(request, patch);
  if (!b || Object.keys(b).length === 0) return jsonError("Invalid request", 400);
  const { data, error } = await supabase.from("dna_collections").update(b).eq("id", id).select("id").maybeSingle();
  if (error) return jsonError("Request failed.", 500);
  return data ? Response.json({ ok: true }) : jsonError("Not found", 404);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data, error } = await supabase.from("dna_collections").delete().eq("id", id).select("id").maybeSingle();
  if (error) return jsonError("Request failed.", 500);
  return data ? Response.json({ ok: true }) : jsonError("Not found", 404);
}
