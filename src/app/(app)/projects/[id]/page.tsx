import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { Workspace } from "./Workspace";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: project } = await supabase.from("projects").select("id, name, format, language, ratio, archived_at").eq("id", id).maybeSingle();
  if (!project) notFound(); // RLS hides other users' projects: indistinguishable from "does not exist"
  const { data: assets } = await supabase.from("assets")
    .select("id, kind, original_name, mime, bytes, status, archived_at, created_at").eq("project_id", id).order("created_at", { ascending: false });
  return (
    <>
      <PageHeader crumbs={["Projects", project.name]} title={project.name} />
      <Workspace project={project} assets={assets ?? []} />
    </>
  );
}
