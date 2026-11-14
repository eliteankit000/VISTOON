import { describe, expect, it } from "vitest";
import { createLogger } from "../worker/src/logger";
import { handlers, type Ctx } from "../worker/src/processors";
import type { Db, DnaTranscript } from "../worker/src/db";
import type { Finding } from "../src/lib/dna/findings";
import { LlmError, type LlmProvider } from "../src/lib/llm/provider";
import { JOBS } from "../src/lib/queue/contracts";

const body = (hook: string, extra: string) => `${hook} This is the story of a strange night. ${extra} Subscribe for more of these.`;
function world(initial: { id: string; title: string; body: string }[]) {
  const st = { transcripts: initial.map((t) => ({ ...t, highPerformer: false })), obs: new Map<string, unknown[]>(), findings: [] as Finding[], analyses: new Map<string, { status: string; error?: string }>(), saves: 0 };
  const db = {
    claimAnalysis: async (id: string) => { const a = st.analyses.get(id); if (!a || a.status !== "queued") return null; a.status = "running"; return { userId: "u1", collectionId: "c1" }; },
    loadDnaTranscripts: async (): Promise<DnaTranscript[]> => st.transcripts.map((t) => ({ ...t, observations: (st.obs.get(t.id) as DnaTranscript["observations"]) ?? null })),
    saveObservations: async (e: { transcriptId: string; observations: unknown[] }) => { st.obs.set(e.transcriptId, e.observations); },
    saveFindings: async (e: { findings: Finding[] }) => { st.findings = e.findings; st.saves++; },
    finishAnalysis: async (id: string, e: { status: string; error?: string }) => { st.analyses.set(id, { status: e.status, error: e.error }); },
  } as unknown as Db;
  const queue = (id: string) => st.analyses.set(id, { status: "queued" });
  return { st, db, queue };
}
// A model that finds a hook (quoting the transcript's first sentence) and a CTA in every transcript.
function llmFor(texts: string[]) {
  const calls = { n: 0 };
  const llm: LlmProvider = { name: "f", generate: async (r) => {
    calls.n++;
    const t = texts.find((x) => r.user.includes(x.slice(0, 40)))!;
    const hook = t.split(".")[0] + ".";
    return { text: JSON.stringify({ observations: [{ technique: "hook", excerpt: hook, note: "opens big" }, { technique: "cta", excerpt: "Subscribe for more of these.", note: "asks to subscribe" }] }), inputTokens: 1, outputTokens: 1, model: "fm", stopReason: null };
  } };
  return { llm, calls };
}
const ctx = (db: Db, llm: LlmProvider | null, signal = new AbortController().signal) => ({ db, llm, signal, log: createLogger(undefined, "silent"), job: {} as never }) as Ctx;
const run = (id: string, c: Ctx) => handlers.analyzeDna({ analysisId: id }, c);
const T = [1, 2, 3].map((i) => ({ id: `t${i}`, title: `Video ${i}`, body: body(`Nobody saw number ${i} coming at all.`, `Detail ${i} here.`) }));

describe("analyzeDna job", () => {
  it("has a bounded contract and validates its payload", () => {
    expect(JOBS.analyzeDna.attempts).toBe(1); expect(JOBS.analyzeDna.timeoutMs).toBeLessThanOrEqual(30 * 60_000);
    expect(JOBS.analyzeDna.schema.safeParse({ analysisId: "nope" }).success).toBe(false);
    expect(JOBS.analyzeDna.schema.safeParse({ analysisId: "11111111-1111-4111-8111-111111111111", extra: 1 }).success).toBe(false);
  });
  it("accumulates: transcripts added later are analyzed once, earlier ones come from cache, labels update", async () => {
    const w = world(T.slice(0, 2)); const { llm, calls } = llmFor(T.map((t) => t.body));
    w.queue("a1");
    await run("a1", ctx(w.db, llm));
    expect(calls.n).toBe(2);
    expect(w.st.findings.every((f) => f.label === "UNVERIFIED_HYPOTHESIS")).toBe(true); // 2 transcripts: not enough for a pattern
    w.st.transcripts.push({ ...T[2]!, highPerformer: false });
    w.queue("a2");
    const r = await run("a2", ctx(w.db, llm));
    expect(calls.n).toBe(3); // only the NEW transcript cost a call
    expect(r).toMatchObject({ transcripts: 3, fresh: 1 });
    expect(w.st.findings.find((f) => f.techniqueKey === "cta")).toMatchObject({ label: "CORE_PATTERN", sampleCount: 3, totalTranscripts: 3 });
    expect(w.st.analyses.get("a2")!.status).toBe("completed");
  });
  it("is idempotent: a second delivery of the same job does nothing", async () => {
    const w = world(T); const { llm, calls } = llmFor(T.map((t) => t.body)); w.queue("a1");
    await run("a1", ctx(w.db, llm));
    const n = calls.n;
    expect(await run("a1", ctx(w.db, llm))).toEqual({ skipped: true });
    expect(calls.n).toBe(n); expect(w.st.saves).toBe(1);
  });
  it("marks the run failed with a safe message when the model fails, saves no findings, and rethrows", async () => {
    const w = world(T); w.queue("a1");
    const bad: LlmProvider = { name: "x", generate: async () => { throw new LlmError("provider_error", "The AI provider had an error.", false); } };
    await expect(run("a1", ctx(w.db, bad))).rejects.toBeInstanceOf(LlmError);
    expect(w.st.analyses.get("a1")).toEqual({ status: "failed", error: "The AI provider had an error." });
    expect(w.st.saves).toBe(0);
  });
  it("hides unexpected internal errors behind a generic message", async () => {
    const w = world(T); w.queue("a1");
    const bad: LlmProvider = { name: "x", generate: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"); } };
    await expect(run("a1", ctx(w.db, bad))).rejects.toThrow();
    expect(w.st.analyses.get("a1")!.error).toBe("The analysis could not be completed.");
  });
  it("fails cleanly when the AI key is not configured", async () => {
    const w = world(T); w.queue("a1");
    await expect(run("a1", ctx(w.db, null))).rejects.toBeInstanceOf(LlmError);
    expect(w.st.analyses.get("a1")).toMatchObject({ status: "failed", error: "AI analysis is not configured." });
  });
  it("fails when there is nothing to analyze, and stops when cancelled", async () => {
    const e = world([]); e.queue("a1");
    await expect(run("a1", ctx(e.db, llmFor([]).llm))).rejects.toThrow();
    expect(e.st.analyses.get("a1")).toMatchObject({ status: "failed", error: "No transcripts to analyze." });
    const w = world(T); w.queue("a2"); const ac = new AbortController(); ac.abort();
    await expect(run("a2", ctx(w.db, llmFor(T.map((t) => t.body)).llm, ac.signal))).rejects.toThrow("Cancelled");
    expect(w.st.analyses.get("a2")!.status).toBe("failed");
  });
  it("drops fabricated excerpts end to end (no finding without a real quote)", async () => {
    const w = world(T); w.queue("a1");
    const liar: LlmProvider = { name: "l", generate: async () => ({ text: JSON.stringify({ observations: [{ technique: "hook", excerpt: "This sentence does not exist anywhere", note: "x" }] }), inputTokens: 1, outputTokens: 1, model: "m", stopReason: null }) };
    await run("a1", ctx(w.db, liar));
    expect(w.st.findings).toEqual([]);
  });
});
