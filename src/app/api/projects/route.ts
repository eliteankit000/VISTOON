import { z } from "zod";
import { getUser } from "@/lib/auth/guards";
import { csrfGuard, dbError, jsonError, readJson } from "@/lib/api";

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const { data, error } = await supabase.from("projects")
    .select("id, name, format, language, ratio, archived_at, created_at, updated_at").order("updated_at", { ascending: false });
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ projects: data });
}

const create = z.object({
  name: z.string().trim().min(1).max(120),
  format: z.enum(["shorts", "long"]).optional(),
  language: z.enum(["en", "hinglish", "hi"]).optional(),
  ratio: z.enum(["9:16", "16:9", "1:1"]).optional(),
}).strict(); // unknown fields (e.g. user_id, id) are rejected: no mass assignment

export async function POST(request: Request) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const { supabase, user } = await getUser();
  if (!user) return jsonError("Not signed in", 401);
  const body = await readJson(request, create);
  if (!body) return jsonError("Invalid request", 400);
  // user_id comes from the verified session, never from the client. RLS + the plan-limit trigger run in the database.
  const { data, error } = await supabase.from("projects").insert({ ...body, user_id: user.id }).select("id").single();
  if (error) return dbError(error.message);
  return Response.json({ id: data.id }, { status: 201 });
}
