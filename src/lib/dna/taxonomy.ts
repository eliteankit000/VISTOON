/** The fixed set of techniques the analyzer may report. The model picks from this list; it cannot invent categories. */
export const TECHNIQUES = [
  { key: "hook", label: "Opening hook", desc: "The first lines that make the viewer stay" },
  { key: "curiosity_gap", label: "Curiosity gap", desc: "A question or promise that withholds the answer" },
  { key: "open_loop", label: "Open loop", desc: "A thread opened early and closed later" },
  { key: "escalation", label: "Escalation", desc: "Stakes or intensity rising from beat to beat" },
  { key: "emotional_beat", label: "Emotional beat", desc: "A moment aimed at a feeling (awe, fear, humour, empathy)" },
  { key: "pattern_interrupt", label: "Pattern interrupt", desc: "A sudden change of tone, pace or direction" },
  { key: "example", label: "Concrete example", desc: "A specific case, number or story illustrating a point" },
  { key: "transition", label: "Transition device", desc: "A line that bridges sections and keeps momentum" },
  { key: "payoff", label: "Payoff", desc: "Delivering what the opening promised" },
  { key: "cta", label: "Call to action", desc: "A request to like, follow, comment or continue" },
  { key: "ending", label: "Ending move", desc: "How the piece closes (twist, callback, question, cliffhanger)" },
  { key: "rhythm", label: "Sentence rhythm", desc: "Deliberate short/long sentence patterns" },
] as const;
export type TechniqueKey = (typeof TECHNIQUES)[number]["key"];
export const TECHNIQUE_KEYS = TECHNIQUES.map((t) => t.key) as [TechniqueKey, ...TechniqueKey[]];
export const techniqueLabel = (k: string) => TECHNIQUES.find((t) => t.key === k)?.label ?? k;

export const LABELS = ["CORE_PATTERN", "HIGH_PERFORMER_ASSOCIATION", "CONTEXT_DEPENDENT", "RARE_TECHNIQUE", "UNVERIFIED_HYPOTHESIS"] as const;
export type Label = (typeof LABELS)[number];
