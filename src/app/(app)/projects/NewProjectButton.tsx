"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, Input, Select, useToast } from "@/components/ui";

export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("shorts");
  const [language, setLanguage] = useState("en");
  const toast = useToast();
  const router = useRouter();

  async function create() {
    setBusy(true);
    const ratio = format === "shorts" ? "9:16" : "16:9";
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, format, language, ratio }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast(j.error ?? "Could not create the project.", "danger");
    setOpen(false); setName("");
    router.push(`/projects/${j.id}`);
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>New project</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New project">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus /></Field>
          <Field label="Format"><Select value={format} onChange={(e) => setFormat(e.target.value)}><option value="shorts">Shorts (9:16)</option><option value="long">Long-form (16:9)</option></Select></Field>
          <Field label="Language"><Select value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="hinglish">Hinglish (Roman)</option><option value="hi">Hindi (Devanagari)</option></Select></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
