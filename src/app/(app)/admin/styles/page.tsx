import { Card, CardHeader, PageHeader, MockBanner, Field, Input, Textarea, Badge } from "@/components/ui";

const caps = [["Stick-figure components", "DETECTED"], ["Render entry point", "NEEDS_REVIEW"], ["Sample render", "UNSUPPORTED"]];

export default function StyleEditor() {
  return (
    <>
      <PageHeader crumbs={["Admin", "Styles"]} title="Style editor" />
      <MockBanner />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Metadata" /><div className="space-y-3 p-5"><Field label="Name"><Input defaultValue="Stick-figure explainer" /></Field><Field label="Description"><Textarea rows={3} /></Field></div></Card>
        <Card>
          <CardHeader title="Capability report" desc="Nothing is Verified until an isolated test render succeeds." />
          <ul className="divide-y divide-line">{caps.map(([c, s]) => <li key={c} className="flex justify-between px-5 py-3 text-sm"><span>{c}</span><Badge tone="warn">{s}</Badge></li>)}</ul>
        </Card>
      </div>
    </>
  );
}
