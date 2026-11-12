export type StyleStatus = "draft" | "needs_review" | "testing" | "verified" | "published";
const NEXT: Record<StyleStatus, StyleStatus[]> = {
  draft: ["needs_review"],
  needs_review: ["draft", "testing"],
  testing: ["needs_review", "verified"],
  verified: ["testing", "published"],
  published: ["verified"], // unpublish goes back to verified, never straight to draft
};
export function canTransition(from: StyleStatus, to: StyleStatus, hasVerifiedVersion: boolean): { ok: boolean; reason?: string } {
  if (!NEXT[from].includes(to)) return { ok: false, reason: `Cannot move from ${from} to ${to}` };
  if ((to === "verified" || to === "published") && !hasVerifiedVersion)
    return { ok: false, reason: "Needs a style version verified by a passing isolated test render" };
  return { ok: true };
}
