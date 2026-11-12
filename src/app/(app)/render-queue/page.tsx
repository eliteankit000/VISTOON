import { Card, Badge, Progress, PageHeader, MockBanner } from "@/components/ui";
import { renderJobs } from "@/lib/mock";

export default function Queue() {
  return (
    <>
      <PageHeader title="Render Queue" desc="Monitor cloud render jobs." />
      <MockBanner />
      <Card>
        <ul className="divide-y divide-line">
          {renderJobs.map((j) => (
            <li key={j.id} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[1fr_160px_120px]">
              <div><p className="text-sm font-medium">{j.project}</p><p className="text-xs text-muted">{j.id} · {j.style} · {j.started}</p></div>
              <Progress value={j.progress} tone={j.state === "Failed" ? "danger" : j.state === "Completed" ? "success" : "accent"} />
              <Badge tone={j.state === "Failed" ? "danger" : j.state === "Completed" ? "success" : "accent"}>{j.state}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
