"use client";
import * as React from "react";
import Link from "next/link";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";

type Project = { id: string; name: string; archived_at: string | null };
type Version = { id: string; body: string; actual_count: number | null; counter_policy: string; created_at: string };

export default function ScriptStudio() {
  const toast = useToast();
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  const [projectId, setProjectId] = React.useState("");
  const [versions, setVersions] = React.useState<Version[]>([]);
  const [current, setCurrent] = React.useState<Version | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [f, setF] = React.useState({ topic: "", niche: "", audience: "", format: "shorts", language: "en", tone: "", targetWords: "" });

  React.useEffect(() => {
    void (async () => {
      const r = await fetch("/api/projects");
      if (!r.ok) { setErr("Could not load your projects."); return; }
      const list = ((await r.json()).projects as Project[]).filter((p) => !p.archived_at);
      setProjects(list);
      if (list[0]) setProjectId(list[0].id);
    })();
  }, []);

  React.useEffect(() => {
    if (!projectId) return;
    setCurrent(null); setVersions([]);
    void (async () => {
      const r = await fetch(`/api/projects/${projectId}/scripts`);
      if (r.ok) { const v = (await r.json()).versions as Version[]; setVersions(v); setCurrent(v[0] ?? null); }
    })();
  }, [projectId]);

  async function generate() {
    setBusy(true);
    const body: Record<string, unknown> = { topic: f.topic, format: f.format, language: f.language };
    for (const k of ["niche", "audience", "tone"] as const) if (f[k].trim()) body[k] = f[k].trim();
    if (f.targetWords) body.targetWords = Number(f.targetWords);
    const r = await fetch(`/api/projects/${projectId}/scripts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast(j.error ?? "Generation failed", "danger"); return; }
    setVersions((v) => [j.version, ...v]); setCurrent(j.version); toast("Script saved as a new version", "success");
  }

  if (err) return <EmptyState title={err} />;
  if (!projects) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  if (projects.length === 0) return <EmptyState title="Create a project first" desc="Scripts are saved inside a project." action={<Link href="/projects"><Button>Go to Projects</Button></Link>} />;

  const valid = f.topic.trim().length >= 3 && (!f.targetWords || (Number(f.targetWords) >= 20 && Number(f.targetWords) <= 3000));
  return (
    <>
      <PageHeader title="Script Studio" desc="Generate a script and save it as a version. Exact-length enforcement and quality scoring come next." />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader title="Brief" />
          <div className="space-y-3 p-5">
            <Field label="Project"><Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label="Topic"><Input value={f.topic} maxLength={300} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="What is the video about?" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Niche"><Input value={f.niche} maxLength={100} onChange={(e) => setF({ ...f, niche: e.target.value })} /></Field>
              <Field label="Audience"><Input value={f.audience} maxLength={100} onChange={(e) => setF({ ...f, audience: e.target.value })} /></Field>
            </div>
            <Field label="Language"><Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}><option value="en">English</option><option value="hinglish">Hinglish (Roman)</option><option value="hi">Hindi (Devanagari)</option></Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Format"><Select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}><option value="shorts">Shorts</option><option value="long">Long-form</option></Select></Field>
              <Field label="Approx. words" hint="20–3000"><Input type="number" min={20} max={3000} value={f.targetWords} onChange={(e) => setF({ ...f, targetWords: e.target.value })} /></Field>
            </div>
            <Field label="Tone / instructions"><Textarea rows={3} maxLength={300} value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} /></Field>
            <Button className="w-full" loading={busy} disabled={!valid} onClick={generate}>Generate script</Button>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Script" action={current ? <Badge>{current.actual_count} words ({current.counter_policy})</Badge> : undefined} desc="Word count is computed by the server, not by the AI." />
            <div className="p-5">
              {current ? <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{current.body}</pre>
                : <EmptyState title="No script yet" desc="Fill in the brief and generate one." />}
            </div>
          </Card>
          {versions.length > 1 && (
            <Card>
              <CardHeader title="Version history" />
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id}><button className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-hover" onClick={() => setCurrent(v)}>
                    <span className="truncate">{v.body.slice(0, 70)}…</span><span className="ml-3 shrink-0 text-xs text-muted">{v.actual_count} words · {new Date(v.created_at).toLocaleString()}</span>
                  </button></li>))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
