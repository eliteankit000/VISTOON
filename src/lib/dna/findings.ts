import { techniqueLabel, TECHNIQUE_KEYS, type Label, type TechniqueKey } from "./taxonomy";
import type { Observation } from "./extract";

export type TranscriptRef = { id: string; title: string; highPerformer: boolean };
export type Evidence = { transcriptId: string; title: string; excerpt: string; note: string };
export type Counterexample = { transcriptId: string; title: string; note: string };
export type Finding = {
  techniqueKey: TechniqueKey; technique: string; label: Label; explanation: string; confidence: "low" | "medium" | "high";
  sampleCount: number; totalTranscripts: number; evidence: Evidence[]; counterexamples: Counterexample[];
};

export const MIN_SAMPLE_FOR_PATTERN = 3;
/** Thresholds are in code so labels are reproducible and explainable; the model never assigns a label. */
export const THRESHOLDS = { core: 0.6, contextLow: 0.25, highPerformerShare: 0.7, otherShareMax: 0.6, minHighPerformers: 3 };

/**
 * Cumulative findings across all included transcripts.
 * - Fewer than 3 transcripts: everything is an UNVERIFIED_HYPOTHESIS, whatever the model saw.
 * - CORE_PATTERN: in >= 60% of transcripts and at least 3.
 * - HIGH_PERFORMER_ASSOCIATION: needs user-marked high performers (>= 3); in >= 70% of them and < 60% of the rest. An association, not a cause.
 * - CONTEXT_DEPENDENT: appears in 25–60% (and at least 2).
 * - RARE_TECHNIQUE: appears in under 25% of a sample of >= 5.
 * - Anything else stays UNVERIFIED_HYPOTHESIS.
 */
export function buildFindings(transcripts: TranscriptRef[], byTranscript: Map<string, Observation[]>): Finding[] {
  const n = transcripts.length;
  if (n === 0) return [];
  const high = transcripts.filter((t) => t.highPerformer), rest = transcripts.filter((t) => !t.highPerformer);
  const out: Finding[] = [];
  for (const key of TECHNIQUE_KEYS) {
    const having = transcripts.filter((t) => (byTranscript.get(t.id) ?? []).some((o) => o.technique === key));
    const k = having.length;
    if (k === 0) continue;
    const share = k / n;
    const hHigh = high.filter((t) => having.includes(t)).length, hRest = rest.filter((t) => having.includes(t)).length;
    const highShare = high.length ? hHigh / high.length : 0, restShare = rest.length ? hRest / rest.length : 0;

    let label: Label; let why: string;
    if (n < MIN_SAMPLE_FOR_PATTERN) { label = "UNVERIFIED_HYPOTHESIS"; why = `Only ${n} transcript${n === 1 ? "" : "s"} so far; at least ${MIN_SAMPLE_FOR_PATTERN} are needed before calling anything a pattern.`; }
    else if (share >= THRESHOLDS.core && k >= MIN_SAMPLE_FOR_PATTERN) { label = "CORE_PATTERN"; why = `Present in ${k} of ${n} transcripts (${pct(share)}).`; }
    else if (high.length >= THRESHOLDS.minHighPerformers && highShare >= THRESHOLDS.highPerformerShare && restShare < THRESHOLDS.otherShareMax) {
      label = "HIGH_PERFORMER_ASSOCIATION"; why = `Present in ${hHigh} of ${high.length} transcripts you marked as high performers (${pct(highShare)}) versus ${hRest} of ${rest.length} others (${pct(restShare)}). This is an association in your sample, not proof that it causes performance.`;
    }
    else if (share >= THRESHOLDS.contextLow && k >= 2) { label = "CONTEXT_DEPENDENT"; why = `Present in ${k} of ${n} transcripts (${pct(share)}): it appears in some contexts but not most.`; }
    else if (share < THRESHOLDS.contextLow && n >= 5) { label = "RARE_TECHNIQUE"; why = `Present in only ${k} of ${n} transcripts (${pct(share)}).`; }
    else { label = "UNVERIFIED_HYPOTHESIS"; why = `Present in ${k} of ${n} transcripts: too little evidence to classify.`; }

    const evidence: Evidence[] = [];
    for (const t of having) { const o = (byTranscript.get(t.id) ?? []).find((x) => x.technique === key)!; evidence.push({ transcriptId: t.id, title: t.title, excerpt: o.excerpt, note: o.note }); if (evidence.length >= 6) break; }
    const counterexamples: Counterexample[] = transcripts.filter((t) => !having.includes(t)).slice(0, 6).map((t) => ({ transcriptId: t.id, title: t.title, note: "No instance of this technique was found in this transcript." }));

    const confidence: Finding["confidence"] = n < MIN_SAMPLE_FOR_PATTERN ? "low" : label === "CORE_PATTERN" && n >= 8 ? "high" : label === "UNVERIFIED_HYPOTHESIS" || label === "RARE_TECHNIQUE" ? "low" : "medium";
    out.push({ techniqueKey: key, technique: techniqueLabel(key), label, explanation: `${why} Based on ${n} transcript${n === 1 ? "" : "s"}; correlation in a small, hand-picked sample is not evidence that a technique causes views.`, confidence, sampleCount: k, totalTranscripts: n, evidence, counterexamples });
  }
  return out;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
