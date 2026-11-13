"use client";
import * as React from "react";
import Link from "next/link";
import { countBy, type CountType } from "@/lib/scripts/count";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";

type Project = { id: string; name: string; archived_at: string | null };
type Version = { id: string; body: string; kind: "generated" | "edit" | "autosave"; actual_count: number | null; counter_policy: string; created_at: string; updated_at: string };
type Save = "idle" | "dirty" | "saving" | "saved" | "error";

export default function ScriptStudio() {
  const toast = useToast();
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  const [projectId, setProjectId] = React.useState("");
  const [versions, setVersions] = React.useState<Version[]>([]);
  const [text, setText] = React.useState("");
  const [save, setSave] = React.useState<Save>("idle");
  const [fitMsg, setFitMsg] = React.useState<string | null>(null);
  const [fitting, setFitting] = React.useState(false);
  const [tType, setTType] = React.useState<CountType>("words");
  const [tCount, setTCount] = React.useState("");
  const loaded = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [f, setF] = React.useState({ topic: "", niche: "", audience: "", format: "shorts", language: "en", tone: "" });

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
    loaded.current = false; setText(""); setVersions([]); setSave("idle"); setFitMsg(null);
    void (async () => {
      const r = await fetch(`/api/projects/${projectId}/scripts`);
      if (r.ok) {
        const v = (await r.json()).versions as Version[];
        const history = v.filter((x) => x.kind !== "autosave");
        setVersions(history);
        const draft = v.find((x) => x.kind === "autosave");
        setText(draft && (!history[0] || draft.updated_at > history[0].created_at) ? draft.body : history[0]?.body ?? "");
      }
      loaded.current = true;
    })();
  }, [projectId]);

  // Autosave: 1.5 s after the last keystroke, to a single draft slot.
  React.useEffect(() => {
    if (!loaded.current || save !== "dirty" || !projectId) return;
    const t = setTimeout(async () => {
      setSave("saving");
      const r = await fetch(`/api/projects/${projectId}/scripts/draft`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: text }) });
      setSave(r.ok ? "saved" : "error");
    }, 1500);
    return () => clearTimeout(t);
  }, [text, save, projectId]);

  const edit = (v: string) => { setText(v); setSave("dirty"); setFitMsg(null); };
  const target = Number(tCount);
  const hasTarget = Number.isInteger(target) && target >= 20 && target <= (tType === "words" ? 3000 : 60000);
  const live = countBy(tType, text);
  const delta = live - target;

  async function saveVersion() {
    const body: Record<string, unknown> = { body: text };
    if (hasTarget) { body.targetType = tType; body.targetCount = target; }
    const r = await fetch(`/api/projects/${projectId}/scripts/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast(j.error ?? "Could not save", "danger"); return; }
    setVersions((v) => [j.version, ...v]); toast(`Version saved (${j.version.actual_count} ${j.version.count_type} by the server)`, "success");
  }

  async function fit() {
    setFitting(true); setFitMsg(null);
    const r = await fetch(`/api/projects/${projectId}/scripts/fit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, targetType: tType, targetCount: target }) });
    const j = await r.json().catch(() => ({}));
    setFitting(false);
    if (!r.ok) { toast(j.error ?? "Could not adjust", "danger"); return; }
    const res = j.result as { body: string; exact: boolean; actual: number; rounds: unknown[]; llmCalls: number };
    edit(res.body);
    setFitMsg(res.exact ? `Exactly ${res.actual} ${tType} after ${res.llmCalls} correction${res.llmCalls === 1 ? "" : "s"}.` : `Closest after ${res.llmCalls} rounds: ${res.actual} ${tType} (target ${target}). Not exact: edit by hand or try again.`);
  }

  async function generate() {
    setBusy(true);
    const body: Record<string, unknown> = { topic: f.topic, format: f.format, language: f.language };
    for (const k of ["niche", "audience", "tone"] as const) if (f[k].trim()) body[k] = f[k].trim();
    if (hasTarget) { body.targetType = tType; body.targetCount = target; }
    const r = await fetch(`/api/projects/${projectId}/scripts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast(j.error ?? "Generation failed", "danger"); return; }
    setVersions((v) => [j.version, ...v]); setText(j.version.body); setSave("idle");
    toast(j.lengthExact === false ? "Saved, but the exact length was not reached. Use Adjust to try again." : "Script saved as a new version", j.lengthExact === false ? "neutral" : "success");
  }

  if (err) return <EmptyState title={err} />;
  if (!projects) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  if (projects.length === 0) return <EmptyState title="Create a project first" desc="Scripts are saved inside a project." action={<Link href="/projects"><Button>Go to Projects</Button></Link>} />;

  const valid = f.topic.trim().length >= 3 && (!tCount || hasTarget);
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
              <Field label="Exact length" hint={tType === "words" ? "20–3000" : "20–60000"}><div className="flex gap-1"><Select value={tType} onChange={(e) => setTType(e.target.value as CountType)}><option value="words">words</option><option value="chars">chars</option></Select><Input type="number" value={tCount} onChange={(e) => setTCount(e.target.value)} /></div></Field>
            </div>
            <Field label="Tone / instructions"><Textarea rows={3} maxLength={300} value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} /></Field>
            <Button className="w-full" loading={busy} disabled={!valid} onClick={generate}>Generate script</Button>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Script editor"
              desc="Counts are computed by our own deterministic counter, never by the AI. The server count is the one that is saved."
              action={<span className="flex items-center gap-2">
                <Badge>{live} {tType}</Badge>
                {hasTarget && <Badge tone={delta === 0 ? "success" : "warn"}>{delta === 0 ? "Exact" : delta > 0 ? `${delta} over` : `${-delta} under`}</Badge>}
              </span>} />
            <div className="space-y-3 p-5">
              <Textarea rows={14} maxLength={60000} value={text} onChange={(e) => edit(e.target.value)} placeholder="Generate a script, or write one here…" aria-label="Script text" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted" aria-live="polite">{{ idle: "", dirty: "Unsaved changes…", saving: "Saving draft…", saved: "Draft saved", error: "Autosave failed. Your text is still here; use Save version." }[save]}</span>
                <span className="flex gap-2">
                  <Button variant="secondary" loading={fitting} disabled={!hasTarget || text.trim().length < 5 || delta === 0} onClick={fit}>Adjust to exact length</Button>
                  <Button disabled={text.trim().length === 0} onClick={saveVersion}>Save version</Button>
                </span>
              </div>
              {fitMsg && <p className="text-sm text-muted">{fitMsg}</p>}
            </div>
          </Card>
          {versions.length > 0 && (
            <Card>
              <CardHeader title="Version history" />
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id}><button className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-hover" onClick={() => { setText(v.body); setSave("dirty"); setFitMsg(null); }}>
                    <span className="truncate">{v.body.slice(0, 70)}…</span><span className="ml-3 shrink-0 text-xs text-muted">{v.kind} · {v.actual_count} · {new Date(v.created_at).toLocaleString()}</span>
                  </button></li>))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
