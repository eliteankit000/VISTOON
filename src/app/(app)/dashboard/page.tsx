import Link from "next/link";
import { Card, CardHeader, Badge, PageHeader, Button, EmptyState, Progress, formatBytes } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";

export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const [{ data: projects }, { data: assets }, { data: sub }] = await Promise.all([
    supabase.from("projects").select("id, name, format, archived_at, updated_at").order("updated_at", { ascending: false }),
    supabase.from("assets").select("bytes"),
    supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle(),
  ]);
  const { data: limits } = await supabase.from("plan_limits").select("max_projects, max_storage_bytes").eq("plan", sub?.plan ?? "free").maybeSingle();
  const active = (projects ?? []).filter((p) => !p.archived_at);
  const used = (assets ?? []).reduce((n, a) => n + Number(a.bytes), 0);
  const maxP = limits?.max_projects ?? 0, maxS = Number(limits?.max_storage_bytes ?? 0);
  return (
    <>
      <PageHeader title="Dashboard" desc="Your projects and usage." actions={<Link href="/projects"><Button>New project</Button></Link>} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-xs text-muted">Plan</p><p className="mt-1 text-xl font-semibold capitalize">{sub?.plan ?? "free"}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted">Projects</p><p className="mt-1 text-xl font-semibold">{active.length} / {maxP}</p><div className="mt-3"><Progress value={maxP ? Math.min(100, (active.length / maxP) * 100) : 0} /></div></Card>
        <Card className="p-5"><p className="text-xs text-muted">Storage</p><p className="mt-1 text-xl font-semibold">{formatBytes(used)} / {formatBytes(maxS)}</p><div className="mt-3"><Progress value={maxS ? Math.min(100, (used / maxS) * 100) : 0} /></div></Card>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent projects" />
          {active.length === 0 ? <EmptyState title="No projects yet" desc="Create one to get started." /> : (
            <ul className="divide-y divide-line">
              {active.slice(0, 5).map((p) => (
                <li key={p.id}><Link href={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-hover">
                  <span className="truncate text-sm font-medium">{p.name}</span><Badge>{p.format === "long" ? "Long-form" : "Shorts"}</Badge>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
        <Card><CardHeader title="Renders" /><EmptyState title="No renders yet" desc="Rendering arrives in a later phase." /></Card>
      </div>
    </>
  );
}
