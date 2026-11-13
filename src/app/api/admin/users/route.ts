import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";

/** Admin-only (admin role + MFA session). RLS also lets admins read all profiles. */
export async function GET(request: Request) {
  const g = await requireAdminApi();
  if (g.error) return g.error;
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 50, 1), 100);
  const { data, error } = await g.ctx.supabase.from("profiles").select("user_id, display_name, role, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ users: data, me: g.ctx.user.id });
}

const patch = z.object({ userId: z.string().uuid(), role: z.enum(["user", "admin"]) }).strict();

const ERRORS: Record<string, [string, number]> = {
  cannot_change_own_role: ["You cannot change your own role.", 409],
  user_not_found: ["User not found.", 404],
  not_admin: ["Not allowed.", 403],
};

export async function PATCH(request: Request) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const g = await requireAdminApi();
  if (g.error) return g.error;
  const body = await readJson(request, patch);
  if (!body) return jsonError("Invalid request", 400);
  const { error } = await createServiceClient().rpc("admin_set_role", { actor: g.ctx.user.id, target: body.userId, new_role: body.role });
  if (error) {
    const hit = Object.entries(ERRORS).find(([k]) => error.message.includes(k));
    return hit ? jsonError(hit[1][0], hit[1][1]) : jsonError("Request failed.", 500);
  }
  return Response.json({ ok: true });
}
