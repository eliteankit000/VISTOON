import { requireAdminApi } from "@/lib/auth/guards";
import { jsonError } from "@/lib/api";

/** Newest first, keyset pagination: ?before=<id>&limit=50&action=<prefix>. RLS: only admins can read the audit log. */
export async function GET(request: Request) {
  const g = await requireAdminApi();
  if (g.error) return g.error;
  const q = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(q.get("limit")) || 50, 1), 200);
  const before = Number(q.get("before"));
  const action = q.get("action");
  let query = g.ctx.supabase.from("audit_log").select("id, actor, action, target, meta, at").order("id", { ascending: false }).limit(limit);
  if (Number.isSafeInteger(before) && before > 0) query = query.lt("id", before);
  if (action && /^[a-z_.]{1,40}$/.test(action)) query = query.like("action", `${action}%`);
  const { data, error } = await query;
  if (error) return jsonError("Request failed.", 500);
  return Response.json({ entries: data, next: data.length === limit ? data[data.length - 1]?.id ?? null : null });
}
