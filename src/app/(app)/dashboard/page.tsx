import Link from "next/link";
import { Card, CardHeader, Badge, Progress, PageHeader, MockBanner, Button } from "@/components/ui";
import { projects, renderJobs } from "@/lib/mock";

export default function Dashboard() {
  return (
    <>
      <PageHeader title="Dashboard" desc="Recent projects, renders and usage."
        actions={<Link href="/projects"><Button>New project</Button></Link>} />
      <MockBanner />
      <div className="grid gap-4 md:grid-cols-3">
        {[["Render minutes", "12 / 60"], ["Script generations", "18 / 100"], ["Storage", "1.4 GB / 5 GB"]].map(([k, v]) => (
          <Card key={k} className="p-5"><p className="text-xs text-muted">{k}</p><p className="mt-1 text-xl font-semibold">{v}</p></Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent projects" />
          <ul className="divide-y divide-line">
            {projects.map((p) => (
              <li key={p.id}><Link href={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-hover">
                <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted">{p.format} · {p.language} · {p.updated}</p></div>
                <Badge tone="accent">{p.status}</Badge>
              </Link></li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Render jobs" />
          <ul className="divide-y divide-line">
            {renderJobs.slice(0, 3).map((j) => (
              <li key={j.id} className="px-5 py-3">
                <div className="mb-2 flex justify-between text-sm"><span className="font-medium">{j.project}</span><span className="text-muted">{j.state}</span></div>
                <Progress value={j.progress} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
