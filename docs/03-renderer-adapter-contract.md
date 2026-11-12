# Renderer adapter contract (draft v0)

The web app and queue never call a kit directly. They call an adapter. Each kit (what-if/Remotion,
cartoon/three.js, …) is one adapter implementation running **only inside the render worker**.

```ts
export type JobState =
  | "queued" | "aligning_audio" | "planning" | "storyboarding" | "awaiting_review"
  | "rendering" | "mixing" | "mastering" | "quality_checking" | "completed" | "failed" | "cancelled";

export interface StyleCapabilities {
  styleId: string; version: string;           // immutable published version
  ratios: ("9:16" | "16:9" | "1:1")[];
  fps: number[]; maxSeconds: number;
  needsAssets: string[];                       // e.g. ["voiceover"]
  verified: boolean;                           // true only after an isolated test render passed
}

export interface RenderRequest {
  jobId: string;                               // idempotency key
  userId: string; projectId: string;
  styleVersionId: string;
  ratio: "9:16" | "16:9" | "1:1"; fps: number;
  scriptVersionId: string;
  assets: { voiceover?: AssetRef; references?: AssetRef[] };   // signed, time-limited URLs
  storyboardApproved?: boolean;
  limits: { maxSeconds: number; maxMemoryMb: number; maxCpuSeconds: number };
}
export interface AssetRef { assetId: string; url: string; sha256: string; bytes: number }

export interface RenderEvent { jobId: string; state: JobState; progress: number; message?: string; at: string }

export interface RenderResult {
  jobId: string;
  video: { key: string; seconds: number; width: number; height: number; sha256: string };
  stills?: string[];
  qa: {
    pass: boolean;
    checks: { name: "duration" | "loudness_lufs" | "true_peak" | "black_frames" | "audio_present";
              value: number | string; pass: boolean }[];
  };
  toolVersions: Record<string, string>;        // ffmpeg, node, remotion, chromium
  costs?: { elevenlabsCredits?: number };
}

export interface RendererAdapter {
  capabilities(): Promise<StyleCapabilities[]>;
  validate(req: RenderRequest): Promise<{ ok: boolean; errors: string[] }>;   // no side effects
  storyboard(req: RenderRequest, emit: (e: RenderEvent) => void): Promise<{ stills: string[] }>;
  render(req: RenderRequest, emit: (e: RenderEvent) => void, signal: AbortSignal): Promise<RenderResult>;
}
```

## Rules
1. **Idempotent by `jobId`**: a retry never double-bills or double-writes.
2. **Output is untrusted until QA passes.** A job is `completed` only if every QA check passes. Otherwise `failed` with the failing checks recorded.
3. **Worker isolation** (ADR-4): no network except the signed asset/URL endpoints, no secrets in env, non-root, temp dir wiped per job.
4. **Timeouts and cancellation** via `AbortSignal`; stuck jobs are found by a heartbeat (Day 6).
5. **Loudness**: mastered to -14 LUFS, true peak ≤ -1.5 dBTP (matches what-if `master.py`).
6. Max two storyboard review rounds by default (matches the Video Studio screen).
