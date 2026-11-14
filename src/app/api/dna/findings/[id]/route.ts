import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson, uuid } from "@/lib/api";

const patch = z.object({
  status: z.enum(["proposed", "accepted", "rejected"]).optional(),
  explanation: z.string().trim().min(1).max(2000).optional(),
}).strict();

/**
 * Accept, reject or reword a finding. Label, evidence and counts cannot be changed here: the database only lets users update these two
 * columns, and marks a reworded finding as "edited" itself. Cross-user ids simply look like "not found" (row-level security).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { id } = await params;
  if (!uuid.safeParse(id).success) return jsonError("Not found", 404);
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const b = await readJson(request, patch);
  if (!b || Object.keys(b).length === 0) return jsonError("Invalid request", 400);
  const { data, error } = await supabase.from("dna_findings").update(b).eq("id", id).select("id, status, explanation, updated_at").maybeSingle();
  if (error) return jsonError("Request failed.", 500);
  return data ? Response.json({ finding: data }) : jsonError("Not found", 404);
}
