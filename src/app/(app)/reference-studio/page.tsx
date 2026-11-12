import { Card, CardHeader, PageHeader, MockBanner, Button, Badge } from "@/components/ui";
import { UploadCloud } from "lucide-react";

const dims = ["Art direction", "Color palette", "Characters", "Backgrounds", "Camera", "Pacing", "Transitions", "Typography"];

export default function ReferenceStudio() {
  return (
    <>
      <PageHeader title="Reference Studio" desc="Upload references and build a private style profile." />
      <MockBanner />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upload" />
          <div className="p-5">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-bg px-6 py-12 text-center">
              <UploadCloud className="h-7 w-7 text-muted" aria-hidden />
              <p className="text-sm">Drop videos or images here</p>
              <p className="text-xs text-muted">Uploads are disabled in this preview</p>
              <Button variant="secondary" disabled>Choose files</Button>
            </div>
            <label className="mt-4 flex items-start gap-2 text-xs text-muted"><input type="checkbox" className="mt-0.5" /> I confirm I have the rights to upload and use these references.</label>
          </div>
        </Card>
        <Card>
          <CardHeader title="Dimensions to analyze" />
          <div className="flex flex-wrap gap-2 p-5">{dims.map((d) => <Badge key={d}>{d}</Badge>)}</div>
        </Card>
      </div>
    </>
  );
}
