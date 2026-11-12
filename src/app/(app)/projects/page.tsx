import Link from "next/link";
import { Card, Badge, PageHeader, EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { NewProjectButton } from "./NewProjectButton";

export default async function Projects() {
  const { supabase } = await requireUser();
  const { data: projects } = await supabase.from("projects")
    .select("id, name, format, language, ratio, archived_at, updated_at").order("updated_at", { ascending: false });
  const rows = projects ?? [];
  return (
    <>
      <PageHeader title="Projects" desc="Each project holds scripts, assets, styles and renders." actions={<NewProjectButton />} />
      {rows.length === 0 ? (
        <Card><EmptyState title="No projects yet" desc="Create your first project to start adding scripts and files." action={<NewProjectButton />} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="p-5 transition-colors hover:bg-hover">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.format && <Badge>{p.format === "shorts" ? "Shorts" : "Long-form"}</Badge>}
                  {p.language && <Badge>{{ en: "English", hinglish: "Hinglish", hi: "Hindi" }[p.language as "en" | "hinglish" | "hi"]}</Badge>}
                  {p.ratio && <Badge>{p.ratio}</Badge>}
                  {p.archived_at && <Badge tone="warn">Archived</Badge>}
                </div>
                <p className="mt-2 text-xs text-muted">Updated {new Date(p.updated_at).toLocaleDateString()}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
