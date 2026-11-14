import { safeFilename } from "@/lib/scripts/export";

export type ExportFinding = { technique: string; technique_key?: string; label: string; explanation: string; confidence: string; sample_count: number; status: string; evidence: { title: string; excerpt: string; note: string }[]; counterexamples: { title: string; note: string }[]; updated_at?: string };
export type ExportTranscript = { title: string; language: string; word_count: number; excluded: boolean; high_performer: boolean };
export type ExportInput = { name: string; description: string | null; transcripts: ExportTranscript[]; findings: ExportFinding[]; analyzedAt: string | null; includeRejected: boolean };

export const DNA_DISCLAIMER = "Findings describe patterns in the transcripts you chose. A small or hand-picked sample cannot show that a technique causes views or guarantees virality. Labels are assigned by fixed rules from counts; UNVERIFIED_HYPOTHESIS means too little evidence.";

/** Escape text for Markdown AND for viewers that render embedded HTML. */
export function mdEscape(s: string): string {
  return s.replace(/[\r\n]+/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\\`*_{}\[\]()#+!|~]/g, (c) => `\\${c}`).trim();
}

/** Source transcripts are never exported: only titles/metadata and the short excerpts that act as evidence. */
export function buildDnaExport(i: ExportInput, format: "json" | "markdown"): { body: string; type: string; filename: string } {
  const findings = i.findings.filter((f) => i.includeRejected || f.status !== "rejected");
  if (format === "json") {
    return {
      type: "application/json; charset=utf-8", filename: safeFilename(`${i.name}-dna`, "json"),
      body: JSON.stringify({
        collection: { name: i.name, description: i.description }, analyzedAt: i.analyzedAt, disclaimer: DNA_DISCLAIMER,
        transcripts: i.transcripts.map((t) => ({ title: t.title, language: t.language, words: t.word_count, excluded: t.excluded, highPerformer: t.high_performer })),
        findings: findings.map((f) => ({ technique: f.technique, label: f.label, confidence: f.confidence, sampleCount: f.sample_count, status: f.status, explanation: f.explanation, evidence: f.evidence, counterexamples: f.counterexamples })),
      }, null, 2),
    };
  }
  const L: string[] = [`# DNA profile: ${mdEscape(i.name)}`, ""];
  if (i.description) L.push(mdEscape(i.description), "");
  L.push(`_${mdEscape(DNA_DISCLAIMER)}_`, "", `Transcripts analyzed: ${i.transcripts.filter((t) => !t.excluded).length} of ${i.transcripts.length}`, "");
  for (const f of findings) {
    L.push(`## ${mdEscape(f.technique)} — ${f.label}`, "", `Confidence: ${mdEscape(f.confidence)} · Samples: ${f.sample_count} · Review: ${mdEscape(f.status)}`, "", mdEscape(f.explanation), "");
    if (f.evidence.length) { L.push("**Evidence**", ""); for (const e of f.evidence) L.push(`- “${mdEscape(e.excerpt)}” (${mdEscape(e.title)}): ${mdEscape(e.note)}`); L.push(""); }
    if (f.counterexamples.length) L.push(`**Not found in:** ${f.counterexamples.map((c) => mdEscape(c.title)).join(", ")}`, "");
  }
  if (findings.length === 0) L.push("_No findings yet._", "");
  return { type: "text/markdown; charset=utf-8", filename: safeFilename(`${i.name}-dna`, "md"), body: L.join("\n") };
}
