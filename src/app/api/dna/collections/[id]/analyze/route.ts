import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, uuid } from "@/lib/api";
import { DNA_PROMPT_VERSION } from "@/lib/dna/extract";
import { flagEnabled } from "@/lib/flags";
import { getProducer } from "@/lib/queue/producer";
import { reserveSlots } from "@/lib/scripts/guard";
import { createServiceClient } from "@/lib/supabase/service";

/** Queue a background analysis. Only transcripts without cached observations cost AI quota (one slot each). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  if (!(await flagEnabled(supabase, "dna_analyzer"))) return jsonError("The DNA Analyzer is currently unavailable.", 503);
  if (!process.env.REDIS_URL) return jsonError("Background processing is not available right now.", 503);

  const { data: c } = await supabase.from("dna_collections").select("id").eq("id", id).maybeSingle();
  if (!c) return jsonError("Not found", 404);
  const { data: ts } = await supabase.from("dna_transcripts").select("id").eq("collection_id", id).eq("excluded", false);
  if (!ts || ts.length === 0) return jsonError("Add at least one transcript first.", 409);
  const { data: cached } = await supabase.from("dna_observations").select("transcript_id").eq("prompt_version", DNA_PROMPT_VERSION).in("transcript_id", ts.map((t) => t.id));
  const have = new Set((cached ?? []).map((o) => o.transcript_id));
  const fresh = ts.filter((t) => !have.has(t.id)).length;

  const slots = await reserveSlots(user.id, fresh);
  if (slots instanceof Response) return slots;
  const svc = createServiceClient();
  const { data: a, error } = await svc.from("dna_analyses").insert({ user_id: user.id, collection_id: id, status: "queued", transcript_count: ts.length }).select("id").single();
  if (error || !a) {
    await slots.release();
    return error?.message.includes("one_active") ? jsonError("An analysis is already running for this collection.", 409) : jsonError("Request failed.", 500);
  }
  try {
    await getProducer().enqueue("analyzeDna", { analysisId: a.id }, { jobId: `dna-${a.id}` });
  } catch {
    await svc.from("dna_analyses").update({ status: "failed", error: "Could not queue the analysis.", finished_at: new Date().toISOString() }).eq("id", a.id);
    await slots.release();
    return jsonError("Could not queue the analysis. Please try again.", 503);
  }
  return Response.json({ analysis: { id: a.id, status: "queued" }, aiCalls: fresh }, { status: 202 });
}
