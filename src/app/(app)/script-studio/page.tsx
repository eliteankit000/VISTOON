"use client";
import { useMemo, useState } from "react";
import { Card, CardHeader, Field, Input, Select, Textarea, Button, Badge, Progress, PageHeader, MockBanner, useToast } from "@/components/ui";
import { scoreDims } from "@/lib/mock";

// Preview-only naive counter. The real deterministic counter with a documented
// policy (Hindi/Hinglish/contractions/hyphens) is Day 9 and runs server-side.
const naiveWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default function ScriptStudio() {
  const [text, setText] = useState("");
  const toast = useToast();
  const words = useMemo(() => naiveWords(text), [text]);
  return (
    <>
      <PageHeader title="Script Studio" desc="Generate, validate and score scripts." />
      <MockBanner />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader title="Brief" />
          <div className="space-y-3 p-5">
            <Field label="Topic"><Input placeholder="What is the video about?" /></Field>
            <Field label="Language"><Select><option>English</option><option>Hinglish (Roman)</option><option>Hindi (Devanagari)</option></Select></Field>
            <Field label="Format"><Select><option>Shorts</option><option>Long-form</option></Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Target type"><Select><option>Words</option><option>Characters</option></Select></Field>
              <Field label="Exact count"><Input type="number" placeholder="150" /></Field>
            </div>
            <Field label="Tone / instructions"><Textarea rows={3} /></Field>
            <Button className="w-full" onClick={() => toast("Preview only: generation is not connected", "neutral")}>Generate script</Button>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Editor" action={<Badge>Preview counter: {words} words</Badge>} desc="Counting convention will be shown here once the server-side counter ships." />
            <div className="p-5"><Textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your script appears here…" /></div>
          </Card>
          <Card>
            <CardHeader title="Quality score" desc="Sample layout. Scores are mock values, not an assessment of your text." action={<Badge tone="warn">Mock</Badge>} />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {scoreDims.map(([k, v]) => (
                <div key={k}><div className="mb-1 flex justify-between text-xs"><span>{k}</span><span className="text-muted">{v}</span></div><Progress value={v} /></div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
