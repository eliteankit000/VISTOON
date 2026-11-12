import Link from "next/link";
import { Card, CardHeader, Badge, PageHeader, MockBanner } from "@/components/ui";
import { projects } from "@/lib/mock";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.find((x) => x.id === id) ?? projects[0]!;
  return (
    <>
      <PageHeader crumbs={["Projects", p.name]} title={p.name} desc={`${p.format} · ${p.language} · ${p.ratio}`} />
      <MockBanner />
      <div className="grid gap-4 md:grid-cols-2">
        {[["Script", "/script-studio", "Draft v3 · not yet validated"], ["Voiceover & references", "/reference-studio", "No assets uploaded"],
          ["Style", "/animation-library", "No style selected"], ["Video & renders", "/video-studio", "No render yet"]].map(([t, href, s]) => (
          <Link key={t} href={href!}><Card><CardHeader title={t!} action={<Badge>{p.status}</Badge>} /><p className="px-5 py-4 text-sm text-muted">{s}</p></Card></Link>
        ))}
      </div>
    </>
  );
}
