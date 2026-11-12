// ALL DATA IN THIS FILE IS MOCK DATA for UI layout only (plan Day 2).
// It is isolated here so it can be replaced by real API calls and never shipped as production data.
export const MOCK_NOTICE = "Mock data — backend not connected yet";

export type RenderState =
  | "Queued" | "Aligning Audio" | "Planning" | "Storyboarding" | "Awaiting Review"
  | "Rendering" | "Mixing" | "Mastering" | "Quality Checking" | "Completed" | "Failed";

export const projects = [
  { id: "p1", name: "What if you could rewind 10 seconds?", format: "Shorts", language: "English", ratio: "9:16", status: "Script ready", updated: "2 hours ago" },
  { id: "p2", name: "Why Indian trains run late", format: "Long-form", language: "Hinglish", ratio: "16:9", status: "Storyboard review", updated: "Yesterday" },
  { id: "p3", name: "चाँद पर पहला कदम", format: "Shorts", language: "Hindi", ratio: "9:16", status: "Draft", updated: "3 days ago" },
];

export const renderJobs: { id: string; project: string; state: RenderState; progress: number; style: string; started: string }[] = [
  { id: "j-1041", project: "Why Indian trains run late", state: "Awaiting Review", progress: 42, style: "Stick-figure explainer", started: "10:12" },
  { id: "j-1040", project: "What if you could rewind 10 seconds?", state: "Rendering", progress: 68, style: "Stick-figure explainer", started: "09:40" },
  { id: "j-1039", project: "Sample episode", state: "Completed", progress: 100, style: "Stick-figure explainer", started: "Yesterday" },
  { id: "j-1038", project: "Sample episode 2", state: "Failed", progress: 31, style: "Motion graphics", started: "Yesterday" },
];

export const styles = [
  { id: "s1", name: "Stick-figure explainer", category: "Stickman", status: "Published", ratios: ["9:16", "16:9"], verified: true },
  { id: "s2", name: "Motion graphics", category: "Motion graphics", status: "Needs Review", ratios: ["16:9"], verified: false },
  { id: "s3", name: "Whiteboard", category: "Whiteboard", status: "Draft", ratios: [], verified: false },
];

export const findings = [
  { id: "f1", label: "CORE_PATTERN", technique: "Question-first hook", samples: 5, confidence: "High" },
  { id: "f2", label: "HIGH_PERFORMER_ASSOCIATION", technique: "Open loop resolved at 80%", samples: 3, confidence: "Medium" },
  { id: "f3", label: "CONTEXT_DEPENDENT", technique: "Second-person framing", samples: 2, confidence: "Low" },
  { id: "f4", label: "UNVERIFIED_HYPOTHESIS", technique: "Pause before payoff boosts retention", samples: 1, confidence: "Low" },
];

export const scoreDims = [
  ["Hook", 88], ["Clarity", 90], ["Progression", 84], ["Curiosity / retention", 82],
  ["Emotion", 79], ["Pacing", 86], ["Payoff", 85], ["Originality", 80], ["Factual caution", 92],
] as const;
