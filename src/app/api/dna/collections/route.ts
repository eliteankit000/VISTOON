import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson } from "@/lib/api";
import { flagEnabled } from "@/lib/flags";

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data, error } = await supabase.from("dna_collections").select("id, name, description, created_at, updated_at, dna_transcripts(count)").order("updated_at", { ascending: false });
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ collections: data.map((c) => ({ id: c.id, name: c.name, description: c.description, createdAt: c.created_at, updatedAt: c.updated_at, transcriptCount: (c.dna_transcripts as { count: number }[])[0]?.count ?? 0 })) });
}

const create = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional() }).strict();
export async function POST(request: Request) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  if (!(await flagEnabled(supabase, "dna_analyzer"))) return jsonError("The DNA Analyzer is currently unavailable.", 503);
  const b = await readJson(request, create);
  if (!b) return jsonError("Invalid request", 400);
  const { data, error } = await supabase.from("dna_collections").insert({ user_id: user.id, name: b.name, description: b.description ?? null }).select("id, name, description, created_at").single();
  if (error) return error.message.includes("collection_limit_reached") ? jsonError("You have reached the limit of 20 collections.", 409) : jsonError("Request failed.", 500);
  return Response.json({ collection: data }, { status: 201 });
}
