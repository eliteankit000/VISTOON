"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, Badge, PageHeader, MockBanner, Button, Dialog, Field, Input, Select, useToast } from "@/components/ui";
import { projects } from "@/lib/mock";

export default function Projects() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <PageHeader title="Projects" desc="Each project holds scripts, assets, styles and renders."
        actions={<Button onClick={() => setOpen(true)}>New project</Button>} />
      <MockBanner />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="p-5 transition-colors hover:bg-hover">
              <div className="mb-3 flex aspect-video items-center justify-center rounded bg-sidebar text-xs text-muted">No thumbnail</div>
              <p className="text-sm font-medium">{p.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><Badge>{p.format}</Badge><Badge>{p.language}</Badge><Badge>{p.ratio}</Badge></div>
              <p className="mt-2 text-xs text-muted">{p.updated}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="New project">
        <div className="space-y-3">
          <Field label="Name"><Input placeholder="Project name" /></Field>
          <Field label="Format"><Select><option>Shorts</option><option>Long-form</option></Select></Field>
          <Field label="Language"><Select><option>English</option><option>Hinglish (Roman)</option><option>Hindi (Devanagari)</option></Select></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { setOpen(false); toast("Preview only: project was not saved", "neutral"); }}>Create</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
