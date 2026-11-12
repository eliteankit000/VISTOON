import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/service";
import { canTransition, type StyleStatus } from "@/lib/styles-lifecycle";

// Authorization happens on the server for EVERY request: role = admin AND MFA-verified session.
export async function GET() {
  const g = await requireAdminApi();
  if (g.error) return g.error;
  const { data, error } = await g.ctx.supabase.from("styles").select("id, name, category, status");
  if (error) return Response.json({ error: "Query failed" }, { status: 500 });
  return Response.json({ styles: data });
}

const patch = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "needs_review", "testing", "verified", "published"]),
});

export async function PATCH(request: Request) {
  const g = await requireAdminApi();
  if (g.error) return g.error;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { id, status } = parsed.data;

  const svc = createServiceClient();
  const { data: style } = await svc.from("styles").select("status").eq("id", id).single();
  if (!style) return Response.json({ error: "Not found" }, { status: 404 });
  const { count } = await svc.from("style_versions").select("id", { count: "exact", head: true }).eq("style_id", id).not("verified_at", "is", null);
  const t = canTransition(style.status as StyleStatus, status, (count ?? 0) > 0);
  if (!t.ok) return Response.json({ error: t.reason }, { status: 409 });

  const { error } = await svc.from("styles").update({ status }).eq("id", id);
  if (error) return Response.json({ error: "Update failed" }, { status: 500 });
  await svc.from("audit_log").insert({ actor: g.ctx.user.id, action: "style.status", target: id, meta: { from: style.status, to: status } });
  return Response.json({ ok: true });
}
