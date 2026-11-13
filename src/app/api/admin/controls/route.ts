import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/guards";
import { csrfGuard, jsonError, readJson } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const g = await requireAdminApi();
  if (g.error) return g.error;
  const [s, f] = await Promise.all([
    g.ctx.supabase.from("kill_switches").select("key, engaged, reason, description, updated_at").order("key"),
    g.ctx.supabase.from("feature_flags").select("key, enabled, description, updated_at").order("key"),
  ]);
  if (s.error || f.error) return jsonError("Request failed.", 500);
  return Response.json({ switches: s.data, flags: f.data });
}

const key = z.string().regex(/^[a-z_]{3,40}$/);
const patch = z.discriminatedUnion("type", [
  z.object({ type: z.literal("switch"), key, engaged: z.boolean(), reason: z.string().max(300).optional() }).strict(),
  z.object({ type: z.literal("flag"), key, enabled: z.boolean() }).strict(),
]);

export async function PATCH(request: Request) {
  const blocked = csrfGuard(request); if (blocked) return blocked;
  const g = await requireAdminApi();
  if (g.error) return g.error;
  const b = await readJson(request, patch);
  if (!b) return jsonError("Invalid request", 400);
  const svc = createServiceClient();
  const { error } = b.type === "switch"
    ? await svc.rpc("admin_set_switch", { actor: g.ctx.user.id, k: b.key, on_off: b.engaged, why: b.reason ?? null })
    : await svc.rpc("admin_set_flag", { actor: g.ctx.user.id, k: b.key, on_off: b.enabled });
  if (error) {
    if (error.message.includes("reason_required")) return jsonError("A reason (3+ characters) is required to engage a kill switch.", 400);
    if (error.message.includes("unknown_")) return jsonError("Not found", 404);
    if (error.message.includes("not_admin")) return jsonError("Not allowed.", 403);
    return jsonError("Request failed.", 500);
  }
  return Response.json({ ok: true });
}
