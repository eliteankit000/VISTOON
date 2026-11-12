import { Card, CardHeader, Badge, PageHeader, MockBanner, Button, Textarea } from "@/components/ui";
import { findings } from "@/lib/mock";

const tone = { CORE_PATTERN: "success", HIGH_PERFORMER_ASSOCIATION: "accent", CONTEXT_DEPENDENT: "neutral", RARE_TECHNIQUE: "neutral", UNVERIFIED_HYPOTHESIS: "warn" } as const;

export default function Dna() {
  return (
    <>
      <PageHeader title="DNA Analyzer" desc="Add transcripts one at a time. Findings keep their evidence." actions={<Button variant="secondary">Export</Button>} />
      <MockBanner />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="Add transcript" />
          <div className="space-y-3 p-5"><Textarea rows={8} placeholder="Paste a transcript…" /><Button className="w-full">Add to collection</Button></div>
        </Card>
        <Card>
          <CardHeader title="Evidence ledger" desc="Sample entries to show the layout." />
          <ul className="divide-y divide-line">
            {findings.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div><p className="text-sm font-medium">{f.technique}</p><p className="text-xs text-muted">{f.samples} sample(s) · confidence {f.confidence}</p></div>
                <Badge tone={tone[f.label as keyof typeof tone]}>{f.label}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
