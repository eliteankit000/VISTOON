import { requireAdminApi } from "@/lib/auth/guards";
import { getProducer } from "@/lib/queue/producer";
import { createServiceClient } from "@/lib/supabase/service";

// Admin-only (role = admin AND MFA-verified session). Read-only: queue depth + worker liveness.
export async function GET() {
  const g = await requireAdminApi();
  if (g.error) return g.error;
  if (!process.env.REDIS_URL) return Response.json({ error: "Queue is not configured" }, { status: 503 });
  try {
    const stats = await getProducer().stats();
    const { data: workers } = await createServiceClient().from("worker_status").select("worker_id, started_at, last_seen, info").order("last_seen", { ascending: false }).limit(20);
    return Response.json({ stats, workers: workers ?? [] });
  } catch {
    return Response.json({ error: "Queue unavailable" }, { status: 503 });
  }
}
