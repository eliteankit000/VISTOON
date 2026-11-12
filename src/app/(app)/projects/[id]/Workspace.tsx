"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Download, FileAudio, FileImage, FileVideo, Trash2, UploadCloud } from "lucide-react";
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Input, formatBytes, useToast } from "@/components/ui";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { BUCKET, validateUploadRequest, type UploadKind } from "@/lib/uploads/rules";

type Project = { id: string; name: string; archived_at: string | null };
type Asset = { id: string; kind: string; original_name: string | null; mime: string; bytes: number; status: string; archived_at: string | null };

const icon = (mime: string) => mime.startsWith("audio/") ? FileAudio : mime.startsWith("video/") ? FileVideo : FileImage;

export function Workspace({ project, assets }: { project: Project; assets: Asset[] }) {
  const router = useRouter();
  const toast = useToast();
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState(project.name);
  const [confirm, setConfirm] = useState<null | { type: "project" } | { type: "asset"; id: string }>(null);
  const voiceRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLInputElement>(null);
  const archived = !!project.archived_at;

  async function api(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }

  async function upload(kind: UploadKind, file: File) {
    if (!rights) return toast("Please confirm you have the rights to this file first.", "danger");
    const pre = validateUploadRequest(kind, file.type, file.size);
    if (!pre.ok) return toast(pre.error, "danger");
    setBusy(`Uploading ${file.name}…`);
    try {
      const init = await api(`/api/projects/${project.id}/assets`, "POST", { kind, name: file.name, mime: file.type, bytes: file.size, rightsConfirmed: true });
      if (!init.ok) return toast(init.json.error ?? "Upload could not start.", "danger");
      const { assetId, path, token, mime } = init.json;
      const { error } = await createBrowserSupabase().storage.from(BUCKET).uploadToSignedUrl(path, token, file, { contentType: mime });
      if (error) { await api(`/api/assets/${assetId}`, "DELETE"); return toast("The upload failed. Please try again.", "danger"); }
      const done = await api(`/api/assets/${assetId}/complete`, "POST");
      if (!done.ok) return toast(done.json.error ?? "The file could not be verified.", "danger");
      toast("File uploaded and verified.", "success");
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  async function download(id: string) {
    const r = await api(`/api/assets/${id}`, "GET");
    if (!r.ok) return toast(r.json.error ?? "Could not create a download link.", "danger");
    window.location.assign(r.json.url);
  }
  async function archiveAsset(a: Asset) {
    const r = await api(`/api/assets/${a.id}`, "PATCH", { archived: !a.archived_at });
    if (!r.ok) toast(r.json.error ?? "Failed.", "danger"); else router.refresh();
  }
  async function saveName() {
    if (name.trim() === project.name || !name.trim()) return;
    const r = await api(`/api/projects/${project.id}`, "PATCH", { name });
    if (!r.ok) toast(r.json.error ?? "Failed.", "danger"); else { toast("Renamed.", "success"); router.refresh(); }
  }
  async function toggleArchive() {
    const r = await api(`/api/projects/${project.id}`, "PATCH", { archived: !archived });
    if (!r.ok) toast(r.json.error ?? "Failed.", "danger"); else router.refresh();
  }
  async function confirmed() {
    if (!confirm) return;
    setBusy("Deleting…");
    const r = confirm.type === "project" ? await api(`/api/projects/${project.id}`, "DELETE") : await api(`/api/assets/${confirm.id}`, "DELETE");
    setBusy(null); setConfirm(null);
    if (!r.ok) return toast(r.json.error ?? "Delete failed.", "danger");
    if (confirm.type === "project") router.push("/projects"); else router.refresh();
  }

  const shown = assets.filter((a) => a.status === "ready");
  const picker = (ref: React.RefObject<HTMLInputElement | null>, kind: UploadKind, accept: string) => (
    <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(kind, f); }} />
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Project" action={archived ? <Badge tone="warn">Archived</Badge> : undefined} />
        <div className="flex flex-wrap items-end gap-3 p-5">
          <div className="w-full max-w-sm"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-label="Project name" onBlur={saveName} /></div>
          <Button variant="secondary" onClick={toggleArchive}><Archive className="h-4 w-4" />{archived ? "Restore" : "Archive"}</Button>
          <Button variant="ghost" onClick={() => setConfirm({ type: "project" })}><Trash2 className="h-4 w-4" />Delete project</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Files" desc="Private to you. Voiceover: MP3, WAV or M4A up to 50 MB. References: PNG, JPEG or WebP up to 10 MB; MP4 or WebM up to 50 MB." />
        <div className="space-y-4 p-5">
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" className="mt-0.5" checked={rights} onChange={(e) => setRights(e.target.checked)} />
            I confirm I have the rights to upload and use these files.
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={archived || !!busy} onClick={() => voiceRef.current?.click()}><UploadCloud className="h-4 w-4" />Upload voiceover</Button>
            <Button variant="secondary" disabled={archived || !!busy} onClick={() => refRef.current?.click()}><UploadCloud className="h-4 w-4" />Upload reference</Button>
            {picker(voiceRef, "voiceover", "audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a")}
            {picker(refRef, "reference", "image/png,image/jpeg,image/webp,video/mp4,video/webm")}
          </div>
          {busy && <p role="status" className="text-sm text-muted">{busy}</p>}
        </div>
        {shown.length === 0 ? <EmptyState title="No files yet" desc="Upload a voiceover or reference to get started." /> : (
          <ul className="divide-y divide-line border-t border-line">
            {shown.map((a) => { const Icon = icon(a.mime); return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.original_name ?? "file"}</p>
                  <p className="text-xs text-muted">{a.kind} · {formatBytes(Number(a.bytes))}</p>
                </div>
                {a.archived_at && <Badge tone="warn">Archived</Badge>}
                <Button size="sm" variant="ghost" onClick={() => download(a.id)} aria-label="Download"><Download className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => archiveAsset(a)} aria-label={a.archived_at ? "Restore" : "Archive"}><Archive className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: "asset", id: a.id })} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
              </li>); })}
          </ul>
        )}
      </Card>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/script-studio" className="text-accent-dark underline">Script Studio</Link>
        <span className="text-muted">· coming in the next phases</span>
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirmed} loading={busy === "Deleting…"}
        title={confirm?.type === "project" ? "Delete this project?" : "Delete this file?"}
        body={confirm?.type === "project" ? "This permanently deletes the project and all of its files. This cannot be undone." : "This permanently deletes the file. This cannot be undone."} />
    </div>
  );
}
