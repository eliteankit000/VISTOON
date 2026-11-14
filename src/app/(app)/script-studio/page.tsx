"use client";
import * as React from "react";
import Link from "next/link";
import { countBy, type CountType } from "@/lib/scripts/count";
import type { Quality } from "@/lib/scripts/quality";
import { Badge, Button, Progress, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";

type Project = { id: string; name: string; archived_at: string | null };
type Version = { id: string; body: string; kind: "generated" | "edit" | "autosave" | "revision"; revision_round: number; scores: { quality?: Quality } | null; actual_count: number | null; counter_policy: string; created_at: string; updated_at: string };
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
  const area = React.useRef<HTMLTextAreaElement>(null);
  const [dnaCols, setDnaCols] = React.useState<{ id: string; name: string }[]>([]);
  const [dnaId, setDnaId] = React.useState("");
  const [selId, setSelId] = React.useState<string | null>(null);
  const [selText, setSelText] = React.useState("");
  const [quality, setQuality] = React.useState<Quality | null>(null);
  const [busyOp, setBusyOp] = React.useState<null | "score" | "revise" | "rewrite">(null);
  const [instr, setInstr] = React.useState("");
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

  React.useEffect(() => { void (async () => { const r = await fetch("/api/dna/collections"); if (r.ok) setDnaCols((await r.json()).collections); })(); }, []);

  React.useEffect(() => {
    if (!projectId) return;
    loaded.current = false; setSelId(null); setQuality(null); setText(""); setVersions([]); setSave("idle"); setFitMsg(null);
    void (async () => {
      const r = await fetch(`/api/projects/${projectId}/scripts`);
      if (r.ok) {
        const v = (await r.json()).versions as Version[];
        const history = v.filter((x) => x.kind !== "autosave");
        setVersions(history);
        const draft = v.find((x) => x.kind === "autosave");
        const useDraft = !!draft && (!history[0] || draft.updated_at > history[0].created_at);
        setText(useDraft ? draft!.body : history[0]?.body ?? "");
        if (!useDraft && history[0]) { setSelId(history[0].id); setSelText(history[0].body); setQuality(history[0].scores?.quality ?? null); }
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

  const pick = (v: Version, setBody = true) => { if (setBody) { setText(v.body); setSave("dirty"); } setSelId(v.id); setSelText(v.body); setQuality(v.scores?.quality ?? null); setFitMsg(null); };
  const dirty = text !== selText;
  const post = async (path: string, body: unknown) => {
    const r = await fetch(`/api/projects/${projectId}/scripts/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  };
  async function score() {
    setBusyOp("score");
    const { ok, j } = await post("score", { text, ...(selId && !dirty ? { versionId: selId } : {}) });
    setBusyOp(null);
    if (!ok) { toast(j.error ?? "Could not score", "danger"); return; }
    setQuality(j.quality);
    if (selId && !dirty) setVersions((vs) => vs.map((v) => (v.id === selId ? { ...v, scores: { ...(v.scores ?? {}), quality: j.quality } } : v)));
  }
  async function revise() {
    if (!selId) return;
    setBusyOp("revise");
    const { ok, j } = await post("revise", { versionId: selId });
    setBusyOp(null);
    if (!ok) { toast(j.error ?? "Could not revise", "danger"); return; }
    setVersions((vs) => [j.version, ...vs]); setText(j.version.body); setSave("idle"); pick(j.version, false);
    toast(`Revision ${j.version.revision_round}/3: ${j.previousTotal} → ${j.version.scores?.quality?.total ?? "?"}${j.improved ? "" : " (no improvement; you can keep the earlier version)"}`, j.improved ? "success" : "neutral");
  }
  async function rewrite() {
    const el = area.current; if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd;
    setBusyOp("rewrite");
    const { ok, j } = await post("rewrite", { text, start: a, end: b, instruction: instr });
    setBusyOp(null);
    if (!ok) { toast(j.error ?? "Could not rewrite", "danger"); return; }
    edit(j.text); setInstr(""); toast("Selection rewritten. Review it, then save a version.", "success");
  }
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
    setVersions((v) => [j.version, ...v]); pick(j.version, false); toast(`Version saved (${j.version.actual_count} ${j.version.count_type} by the server)`, "success");
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
    if (dnaId) body.dnaCollectionId = dnaId;
    const r = await fetch(`/api/projects/${projectId}/scripts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { toast(j.error ?? "Generation failed", "danger"); return; }
    setVersions((v) => [j.version, ...v]); setText(j.version.body); setSave("idle"); pick(j.version, false);
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
            {dnaCols.length > 0 && <Field label="DNA profile (optional)" hint="Uses only findings you accepted or edited"><Select value={dnaId} onChange={(e) => setDnaId(e.target.value)}><option value="">None</option>{dnaCols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
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
              <Textarea ref={area} rows={14} maxLength={60000} value={text} onChange={(e) => edit(e.target.value)} placeholder="Generate a script, or write one here…" aria-label="Script text" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted" aria-live="polite">{{ idle: "", dirty: "Unsaved changes…", saving: "Saving draft…", saved: "Draft saved", error: "Autosave failed. Your text is still here; use Save version." }[save]}</span>
                <span className="flex gap-2">
                  <Button variant="secondary" loading={fitting} disabled={!hasTarget || text.trim().length < 5 || delta === 0} onClick={fit}>Adjust to exact length</Button>
                  <Button disabled={text.trim().length === 0} onClick={saveVersion}>Save version</Button>
                </span>
              </div>
              {fitMsg && <p className="text-sm text-muted">{fitMsg}</p>}
              <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <div className="min-w-[200px] flex-1"><Field label="Rewrite selected text" hint="Select 5–3000 characters above"><Input value={instr} maxLength={200} onChange={(e) => setInstr(e.target.value)} placeholder="e.g. make it punchier" /></Field></div>
                <Button variant="secondary" loading={busyOp === "rewrite"} disabled={instr.trim().length < 3} onClick={rewrite}>Rewrite selection</Button>
              </div>
              {selId && <p className="flex gap-3 text-xs text-muted"><span>Export saved version:</span>{(["txt", "md", "json"] as const).map((x) => <a key={x} className="underline" href={`/api/projects/${projectId}/scripts/export?versionId=${selId}&format=${x}`}>{x}</a>)}</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Quality score" desc="An editorial estimate against a rubric. It does not predict views or virality."
              action={<span className="flex items-center gap-2">
                {quality && <Badge tone={quality.pass ? "success" : "warn"}>{quality.total}/100{quality.pass ? " · passes" : ` · target ${quality.target}`}</Badge>}
                <Button size="sm" variant="secondary" loading={busyOp === "score"} disabled={text.trim().length < 20} onClick={score}>{quality ? "Re-score" : "Score"}</Button>
                <Button size="sm" loading={busyOp === "revise"} disabled={!selId || dirty || !!quality?.pass} onClick={revise}>Improve</Button>
              </span>} />
            <div className="p-5">
              {dirty && selId && <p className="mb-3 text-xs text-muted">You have unsaved edits. Save a version to enable Improve; scoring will use the text above.</p>}
              {!quality ? <EmptyState title="Not scored yet" desc="Click Score to get a rated breakdown with reasons." /> : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {quality.dimensions.map((d) => (
                      <div key={d.key}>
                        <div className="mb-1 flex justify-between text-xs"><span>{d.label} <span className="text-muted">(weight {d.weight})</span></span><span className="text-muted">{d.score}/10</span></div>
                        <Progress value={d.score * 10} />
                        <p className="mt-1 text-xs text-muted">{d.reason}</p>
                        {d.evidence && <p className="mt-1 border-l-2 border-line pl-2 text-xs italic">“{d.evidence}”</p>}
                        {d.score < 9 && <p className="mt-1 text-xs">Try: {d.suggestion}</p>}
                      </div>))}
                  </div>
                  {quality.factualFlags.length > 0 && <div className="rounded border border-line p-3"><p className="text-sm font-medium">Check these claims</p><ul className="mt-1 list-disc pl-5 text-xs text-muted">{quality.factualFlags.map((f, i) => <li key={i}>“{f.quote}” — {f.concern}</li>)}</ul></div>}
                  <p className="text-xs text-muted">Measured by code: {quality.metrics.words} words, {quality.metrics.sentences} sentences, average {quality.metrics.avgSentenceWords} words per sentence, longest {quality.metrics.longestSentenceWords}, vocabulary variety {quality.metrics.uniqueWordRatio}. {quality.disclaimer}</p>
                </div>)}
            </div>
          </Card>
          {versions.length > 0 && (
            <Card>
              <CardHeader title="Version history" />
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id}><button className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-hover" onClick={() => pick(v)}>
                    <span className="truncate">{v.body.slice(0, 70)}…</span><span className="ml-3 shrink-0 text-xs text-muted">{v.kind}{v.revision_round ? ` ${v.revision_round}/3` : ""}{v.scores?.quality ? ` · ${v.scores.quality.total}/100` : ""} · {v.actual_count} · {new Date(v.created_at).toLocaleString()}</span>
                  </button></li>))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
