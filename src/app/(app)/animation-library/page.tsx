import { Card, Badge, PageHeader, MockBanner } from "@/components/ui";
import { styles } from "@/lib/mock";

export default function Library() {
  const published = styles.filter((s) => s.status === "Published");
  return (
    <>
      <PageHeader title="Animation Library" desc="Published styles only." />
      <MockBanner />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {published.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="mb-3 flex aspect-video items-center justify-center rounded bg-sidebar text-xs text-muted">Example MP4 preview placeholder</div>
            <p className="text-sm font-medium">{s.name}</p>
            <div className="mt-2 flex gap-1.5"><Badge>{s.category}</Badge>{s.ratios.map((r) => <Badge key={r}>{r}</Badge>)}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
