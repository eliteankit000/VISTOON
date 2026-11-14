"use client";
import * as React from "react";
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, PageHeader, Select, Skeleton, Textarea, useToast } from "@/components/ui";

type Collection = { id: string; name: string; description: string | null; transcriptCount: number };
type Transcript = { id: string; title: string; language: string; word_count: number; excluded: boolean; high_performer: boolean };
type Evidence = { transcriptId: string; title: string; excerpt: string; note: string };
type Finding = { id: string; technique: string; label: string; explanation: string; confidence: string; sample_count: number; evidence: Evidence[]; counterexamples: { transcriptId: string; title: string; note: string }[]; status: string };
type Analysis = { id: string; status: "queued" | "running" | "completed" | "failed"; error: string | null; transcript_count: number; finished_at: string | null } | null;
type Detail = { collection: { id: string; name: string }; transcripts: Transcript[]; findings: Finding[]; analysis: Analysis };

const tone = { CORE_PATTERN: "success", HIGH_PERFORMER_ASSOCIATION: "accent", CONTEXT_DEPENDENT: "neutral", RARE_TECHNIQUE: "neutral", UNVERIFIED_HYPOTHESIS: "warn" } as const;
const MEANING: Record<string, string> = {
  CORE_PATTERN: "Appears in most transcripts", HIGH_PERFORMER_ASSOCIATION: "More common in the ones you marked as high performers (an association, not a cause)",
  CONTEXT_DEPENDENT: "Appears in some, not most", RARE_TECHNIQUE: "Appears in few transcripts", UNVERIFIED_HYPOTHESIS: "Not enough evidence yet",
};
const MAX_FILE = 400_000;

export default function Dna() {
  const toast = useToast();
  const [cols, setCols] = React.useState<Collection[] | null>(null);
  const [sel, setSel] = React.useState<string>("");
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [newName, setNewName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [high, setHigh] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<null | { kind: "collection" | "transcript"; id: string; name: string }>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id: string; text: string } | null>(null);

  const api = async (url: string, method = "GET", payload?: unknown) => {
    const r = await fetch(url, { method, headers: payload ? { "content-type": "application/json" } : undefined, body: payload ? JSON.stringify(payload) : undefined });
    return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
  };
  const loadCols = React.useCallback(async () => {
    const r = await api("/api/dna/collections");
    if (!r.ok) { setErr("Could not load your collections."); return; }
    setCols(r.j.collections); setErr(null);
    setSel((cur) => cur || r.j.collections[0]?.id || "");
  }, []);
  const loadDetail = React.useCallback(async (id: string) => {
    const r = await api(`/api/dna/collections/${id}`);
    if (r.ok) setDetail(r.j); else setDetail(null);
  }, []);
  React.useEffect(() => { void loadCols(); }, [loadCols]);
  React.useEffect(() => { setDetail(null); if (sel) void loadDetail(sel); }, [sel, loadDetail]);

  // Poll while an analysis is queued/running.
  const active = detail?.analysis && (detail.analysis.status === "queued" || detail.analysis.status === "running");
  React.useEffect(() => {
    if (!active || !sel) return;
    const t = setInterval(() => void loadDetail(sel), 3000);
    return () => clearInterval(t);
  }, [active, sel, loadDetail]);

  async function createCollection() {
    setBusy("create");
    const r = await api("/api/dna/collections", "POST", { name: newName });
    setBusy(null);
    if (!r.ok) { toast(r.j.error ?? "Could not create", "danger"); return; }
    setNewName(""); await loadCols(); setSel(r.j.collection.id);
  }
  async function addTranscript() {
    setBusy("add");
    const r = await api(`/api/dna/collections/${sel}/transcripts`, "POST", { title, body, highPerformer: high });
    setBusy(null);
    if (!r.ok) { toast(r.j.error ?? "Could not add", "danger"); return; }
    setTitle(""); setBody(""); setHigh(false); toast("Transcript added", "success");
    await Promise.all([loadDetail(sel), loadCols()]);
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_FILE) { toast("File is too large (400 KB maximum).", "danger"); return; }
    if (!/\.(txt|srt|vtt)$/i.test(f.name)) { toast("Use a .txt, .srt or .vtt file.", "danger"); return; }
    setBody(await f.text()); if (!title) setTitle(f.name.replace(/\.(txt|srt|vtt)$/i, "").slice(0, 200));
  }
  async function patchT(id: string, p: object) { const r = await api(`/api/dna/transcripts/${id}`, "PATCH", p); if (!r.ok) toast(r.j.error ?? "Failed", "danger"); else await loadDetail(sel); }
  async function patchF(id: string, p: object) {
    const r = await api(`/api/dna/findings/${id}`, "PATCH", p);
    if (!r.ok) { toast(r.j.error ?? "Could not update", "danger"); return false; }
    await loadDetail(sel); return true;
  }
  async function analyze() {
    setBusy("analyze");
    const r = await api(`/api/dna/collections/${sel}/analyze`, "POST");
    setBusy(null);
    if (!r.ok) { toast(r.j.error ?? "Could not start", "danger"); return; }
    toast(r.j.aiCalls === 0 ? "Re-checking with saved results (no new AI calls)" : `Analysis started (${r.j.aiCalls} new transcript${r.j.aiCalls === 1 ? "" : "s"})`, "success");
    await loadDetail(sel);
  }
  async function doDelete() {
    if (!confirmDel) return;
    setBusy("delete");
    const r = await api(confirmDel.kind === "collection" ? `/api/dna/collections/${confirmDel.id}` : `/api/dna/transcripts/${confirmDel.id}`, "DELETE");
    setBusy(null); setConfirmDel(null);
    if (!r.ok) { toast(r.j.error ?? "Could not delete", "danger"); return; }
    if (confirmDel.kind === "collection") { setSel(""); setDetail(null); await loadCols(); } else { await Promise.all([loadDetail(sel), loadCols()]); }
  }

  if (err) return <EmptyState title={err} action={<Button variant="secondary" onClick={loadCols}>Retry</Button>} />;
  if (!cols) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  const included = detail?.transcripts.filter((t) => !t.excluded).length ?? 0;

  return (
    <>
      <PageHeader title="DNA Analyzer" desc="Add transcripts one at a time. Findings keep their evidence, and nothing is called a pattern from a tiny sample." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Collections" />
            <div className="space-y-3 p-5">
              {cols.length > 0 && <Select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Collection">{cols.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.transcriptCount})</option>)}</Select>}
              <div className="flex gap-2"><Input value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} placeholder="New collection name" /><Button variant="secondary" loading={busy === "create"} disabled={!newName.trim()} onClick={createCollection}>Create</Button></div>
              {sel && <Button variant="ghost" size="sm" onClick={() => setConfirmDel({ kind: "collection", id: sel, name: detail?.collection.name ?? "this collection" })}>Delete collection</Button>}
            </div>
          </Card>
          {sel && (
            <Card>
              <CardHeader title="Add transcript" desc="Paste text, or load a .txt / .srt / .vtt file. Private to you." />
              <div className="space-y-3 p-5">
                <Field label="Title"><Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></Field>
                <Textarea rows={8} value={body} maxLength={400000} onChange={(e) => setBody(e.target.value)} placeholder="Paste a transcript…" aria-label="Transcript text" />
                <input type="file" accept=".txt,.srt,.vtt,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} className="text-xs" aria-label="Upload transcript file" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={high} onChange={(e) => setHigh(e.target.checked)} /> This was a high-performing video</label>
                <Button className="w-full" loading={busy === "add"} disabled={!title.trim() || body.trim().length < 50} onClick={addTranscript}>Add to collection</Button>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          {!sel ? <EmptyState title="Create a collection" desc="A collection groups the transcripts you want to learn from." /> : !detail ? <Skeleton className="h-64" /> : (
            <>
              <Card>
                <CardHeader title={`Transcripts (${detail.transcripts.length})`}
                  action={<Button size="sm" loading={busy === "analyze" || !!active} disabled={included === 0 || !!active} onClick={analyze}>{active ? "Analyzing…" : "Analyze"}</Button>} />
                {detail.analysis?.status === "failed" && <p className="border-b border-line px-5 py-2 text-sm text-danger">The last analysis failed: {detail.analysis.error}</p>}
                {detail.transcripts.length === 0 ? <EmptyState title="No transcripts yet" desc="Add your first transcript on the left." /> : (
                  <ul className="divide-y divide-line">
                    {detail.transcripts.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                        <div className="min-w-0"><p className={`truncate text-sm font-medium ${t.excluded ? "text-muted line-through" : ""}`}>{t.title}</p><p className="text-xs text-muted">{t.word_count} words · {t.language}{t.high_performer ? " · high performer" : ""}</p></div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => patchT(t.id, { excluded: !t.excluded })}>{t.excluded ? "Include" : "Exclude"}</Button>
                          <Button size="sm" variant="ghost" onClick={() => patchT(t.id, { highPerformer: !t.high_performer })}>{t.high_performer ? "Unmark" : "High performer"}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDel({ kind: "transcript", id: t.id, name: t.title })}>Remove</Button>
                        </div>
                      </li>))}
                  </ul>)}
              </Card>
              <Card>
                <CardHeader title="Evidence ledger" desc="Every finding shows the excerpts it rests on and the transcripts where it did not appear. Accepted findings can guide Script Studio. Click Analyze after changing transcripts."
                  action={detail.findings.length > 0 ? <span className="flex gap-2 text-xs">{(["json", "markdown"] as const).map((x) => <a key={x} className="underline" href={`/api/dna/collections/${sel}/export?format=${x}`}>Export {x === "json" ? "JSON" : "Markdown"}</a>)}</span> : undefined} />
                {detail.findings.length === 0 ? <EmptyState title="No findings yet" desc={active ? "The analysis is running…" : "Add transcripts and click Analyze."} /> : (
                  <ul className="divide-y divide-line">
                    {detail.findings.map((f) => (
                      <li key={f.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{f.technique}</p>
                          <span className="flex items-center gap-2">{f.status !== "proposed" && <Badge tone={f.status === "rejected" ? "danger" : "success"}>{f.status}</Badge>}<Badge>{f.sample_count} sample{f.sample_count === 1 ? "" : "s"}</Badge><Badge>{f.confidence} confidence</Badge><Badge tone={tone[f.label as keyof typeof tone] ?? "neutral"}>{f.label}</Badge></span>
                        </div>
                        <p className="mt-1 text-xs text-muted">{MEANING[f.label]}</p>
                        {editing?.id === f.id ? (
                          <div className="mt-2 space-y-2"><Textarea rows={3} maxLength={2000} value={editing.text} onChange={(e) => setEditing({ id: f.id, text: e.target.value })} aria-label="Finding wording" />
                            <div className="flex gap-2"><Button size="sm" disabled={!editing.text.trim()} onClick={async () => { if (await patchF(f.id, { explanation: editing.text })) setEditing(null); }}>Save wording</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div></div>
                        ) : <p className={`mt-2 text-sm ${f.status === "rejected" ? "text-muted line-through" : ""}`}>{f.explanation}</p>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button size="sm" variant="secondary" disabled={f.status === "accepted" || f.status === "edited"} onClick={() => patchF(f.id, { status: "accepted" })}>Accept</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: f.id, text: f.explanation })}>Edit wording</Button>
                          {f.status === "rejected" ? <Button size="sm" variant="ghost" onClick={() => patchF(f.id, { status: "proposed" })}>Restore</Button> : <Button size="sm" variant="ghost" onClick={() => patchF(f.id, { status: "rejected" })}>Reject</Button>}
                        </div>
                        <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted">Evidence ({f.evidence.length}) and counterexamples ({f.counterexamples.length})</summary>
                          <ul className="mt-2 space-y-2">{f.evidence.map((e, i) => <li key={i} className="border-l-2 border-line pl-2"><span className="italic">“{e.excerpt}”</span><br /><span className="text-muted">{e.title}: {e.note}</span></li>)}</ul>
                          {f.counterexamples.length > 0 && <p className="mt-2 text-muted">Not found in: {f.counterexamples.map((c) => c.title).join(", ")}</p>}
                        </details>
                      </li>))}
                  </ul>)}
              </Card>
            </>)}
        </div>
      </div>
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={doDelete} loading={busy === "delete"} confirmLabel="Delete"
        title={`Delete ${confirmDel?.kind ?? ""}?`} body={confirmDel?.kind === "collection" ? `“${confirmDel?.name}” and all its transcripts and findings will be permanently deleted.` : `“${confirmDel?.name}” will be removed. Findings update the next time you analyze.`} />
    </>
  );
}
