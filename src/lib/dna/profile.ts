import type { Label } from "./taxonomy";

export type ProfileItem = { technique: string; label: Label; note: string };
type F = { technique: string; label: string; explanation: string; status: string };
const RANK: Record<string, number> = { CORE_PATTERN: 0, HIGH_PERFORMER_ASSOCIATION: 1, CONTEXT_DEPENDENT: 2, RARE_TECHNIQUE: 3, UNVERIFIED_HYPOTHESIS: 4 };

/**
 * A DNA "profile" for Script Studio = the findings the user has vetted (accepted or edited). Proposed (unreviewed) and rejected
 * findings are never used. No source excerpts are included, so writing is guided by technique, not by copying other videos.
 */
export function profileFromFindings(findings: F[], max = 8): ProfileItem[] {
  return findings
    .filter((f) => (f.status === "accepted" || f.status === "edited") && f.label in RANK)
    .sort((a, b) => RANK[a.label]! - RANK[b.label]!)
    .slice(0, max)
    .map((f) => ({ technique: f.technique.replace(/[<>]/g, " ").slice(0, 80), label: f.label as Label, note: f.explanation.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) }));
}
