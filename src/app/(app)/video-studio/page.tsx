import { Card, CardHeader, PageHeader, MockBanner, Button, Badge, Field, Select } from "@/components/ui";

export default function VideoStudio() {
  return (
    <>
      <PageHeader title="Video Studio" desc="Prepare, storyboard and render." />
      <MockBanner />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader title="Setup" />
          <div className="space-y-3 p-5">
            <Field label="Aspect ratio" hint="Only ratios the selected style supports will be offered."><Select><option>9:16</option><option>16:9</option><option>1:1</option></Select></Field>
            <Field label="Style"><Select><option>Select a published style…</option></Select></Field>
            <Button className="w-full" disabled>Prepare project</Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Storyboard" action={<Badge tone="warn">Not generated</Badge>} desc="Max two review rounds by default." />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="flex aspect-video items-center justify-center rounded bg-sidebar text-xs text-muted">Shot {i + 1}</div>)}
          </div>
        </Card>
      </div>
    </>
  );
}
