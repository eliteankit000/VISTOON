// Pure render-job state machine. The same states exist as a Postgres enum (public.job_state).
export const JOB_STATES = [
  "queued", "aligning_audio", "planning", "storyboarding", "awaiting_review",
  "rendering", "mixing", "mastering", "quality_checking", "completed", "failed", "cancelled",
] as const;
export type JobState = (typeof JOB_STATES)[number];

const FORWARD: Record<JobState, JobState[]> = {
  queued: ["aligning_audio"],
  aligning_audio: ["planning"],
  planning: ["storyboarding"],
  storyboarding: ["awaiting_review"],
  awaiting_review: ["rendering", "storyboarding"], // approve, or send back for a revision round
  rendering: ["mixing"],
  mixing: ["mastering"],
  mastering: ["quality_checking"],
  quality_checking: ["completed"],
  completed: [], failed: [], cancelled: [],
};
export const TERMINAL: JobState[] = ["completed", "failed", "cancelled"];
/** States where a worker is actively running the job (so a missing heartbeat means a lost worker). */
export const WORKER_ACTIVE: JobState[] = ["aligning_audio", "planning", "storyboarding", "rendering", "mixing", "mastering", "quality_checking"];

export function canTransition(from: JobState, to: JobState): boolean {
  if (TERMINAL.includes(from)) return false; // finished jobs never change again
  if (to === "failed" || to === "cancelled") return true;
  if (to === "queued") return WORKER_ACTIVE.includes(from); // a retry after a lost worker
  return FORWARD[from].includes(to);
}
