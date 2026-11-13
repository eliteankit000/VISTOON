import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JOBS, QUEUES } from "../src/lib/queue/contracts";
import { createProducer } from "../src/lib/queue/producer";
import { canTransition, JOB_STATES, TERMINAL } from "../src/lib/queue/states";
import type { Db } from "../worker/src/db";
import { createHealthServer } from "../worker/src/health";
import { createLogger, REDACT } from "../worker/src/logger";
import { startWorkers } from "../worker/src/runner";

let redisProc: ChildProcess;
let PORT = 0;
let URL = "";
const freePort = () => new Promise<number>((res) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as { port: number }).port; s.close(() => res(p)); }); });
async function waitFor<T>(fn: () => Promise<T | false | undefined>, ms = 15_000, step = 50): Promise<T> {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error("waitFor timed out"); await new Promise((r) => setTimeout(r, step)); }
}

beforeAll(async () => {
  PORT = await freePort(); URL = `redis://127.0.0.1:${PORT}`;
  redisProc = spawn("redis-server", ["--port", String(PORT), "--bind", "127.0.0.1", "--save", "", "--appendonly", "no", "--maxmemory-policy", "noeviction"], { stdio: "ignore" });
  await waitFor(async () => {
    const probe = new Redis(URL, { lazyConnect: true, maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null });
    probe.on("error", () => undefined);
    try { await probe.connect(); return (await probe.ping()) === "PONG"; } catch { return false; } finally { probe.disconnect(); }
  }, 15_000, 100);
});
afterAll(() => { redisProc?.kill("SIGKILL"); });

function fakeDb() {
  const calls = { audits: [] as { action: string; target?: string; meta?: Record<string, unknown> }[], reap: [] as number[][], removed: [] as string[][], deleted: [] as string[][], status: 0, order: [] as string[] };
  let pending: { id: string; storageKey: string }[] = [];
  let removeFails = false;
  const db: Db = {
    reapStuckJobs: async (s, m) => { calls.reap.push([s, m]); return [{ jobId: "j-lost", ownerId: "u1", action: "requeued" }]; },
    staleQueuedJobs: async () => [],
    stalePendingAssets: async () => pending,
    removeStorage: async (k) => { calls.order.push("remove"); if (removeFails) throw new Error("storage down"); calls.removed.push(k); },
    deleteAssets: async (ids) => { calls.order.push("delete"); calls.deleted.push(ids); },
    recordAudit: async (e) => { calls.audits.push(e); },
    recordUsage: async () => {},
    upsertWorkerStatus: async () => { calls.status++; },
    ping: async () => true,
  };
  return { db, calls, setPending: (p: typeof pending) => { pending = p; }, failRemove: (v: boolean) => { removeFails = v; } };
}

async function setup(extra: Partial<Parameters<typeof startWorkers>[0]> = {}) {
  const prefix = `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const f = fakeDb();
  const errors: { message: string; ctx: Record<string, unknown> }[] = [];
  const producer = createProducer(URL, prefix);
  const runner = await startWorkers({ redisUrl: URL, prefix, db: f.db, log: createLogger(undefined, "silent"), workerId: "test", statusIntervalMs: 0,
    cancelPollMs: 100, reportError: (e, ctx) => errors.push({ message: e.message, ctx }), ...extra });
  const job = (id: string) => producer.getQueue(QUEUES.system).getJob(id);
  const state = async (id: string) => (await job(id))?.getState();
  const dead = () => producer.getQueue(QUEUES.deadLetter).getJobs(["waiting", "completed", "delayed", "active"]);
  const close = async () => { await runner.close(); await producer.close(); };
  return { prefix, f, errors, producer, runner, job, state, dead, close };
}

describe("state machine", () => {
  it("moves forward one step at a time", () => {
    expect(canTransition("queued", "aligning_audio")).toBe(true);
    expect(canTransition("queued", "rendering")).toBe(false);
    expect(canTransition("storyboarding", "awaiting_review")).toBe(true);
    expect(canTransition("awaiting_review", "rendering")).toBe(true);
    expect(canTransition("awaiting_review", "storyboarding")).toBe(true); // revision round
  });
  it("finished jobs never change", () => {
    for (const t of TERMINAL) for (const s of JOB_STATES) expect(canTransition(t, s)).toBe(false);
  });
  it("any running job can fail or be cancelled; only worker-active jobs can be re-queued", () => {
    expect(canTransition("rendering", "failed")).toBe(true);
    expect(canTransition("queued", "cancelled")).toBe(true);
    expect(canTransition("rendering", "queued")).toBe(true);
    expect(canTransition("awaiting_review", "queued")).toBe(false);
  });
});

describe("queue + worker on a real Redis", () => {
  it("processes a job to completion", async () => {
    const t = await setup();
    const { jobId } = await t.producer.enqueue("selftest", { mode: "ok" }, { jobId: "ok-1" });
    await waitFor(async () => (await t.state(jobId)) === "completed");
    expect((await t.job(jobId))?.returnvalue).toMatchObject({ ok: true, attempt: 1 });
    expect(t.errors).toHaveLength(0);
    await t.close();
  });

  it("retries a failing job with backoff and then succeeds (no dead letter)", async () => {
    const t = await setup();
    await t.producer.enqueue("selftest", { mode: "fail_once" }, { jobId: "retry-1", backoffMs: 50 });
    await waitFor(async () => (await t.state("retry-1")) === "completed");
    const j = await t.job("retry-1");
    expect(j?.attemptsMade).toBe(2);
    expect(j?.returnvalue).toMatchObject({ attempt: 2 });
    expect(await t.dead()).toHaveLength(0);
    expect(t.errors).toHaveLength(0);
    await t.close();
  });

  it("records a permanent failure: bounded retries, dead-letter entry, audit log, error report", async () => {
    const t = await setup();
    await t.producer.enqueue("selftest", { mode: "fail_always" }, { jobId: "dead-1", backoffMs: 50 });
    await waitFor(async () => (await t.state("dead-1")) === "failed");
    await waitFor(async () => (await t.dead()).length === 1);
    const j = await t.job("dead-1");
    expect(j?.attemptsMade).toBe(3); // exactly the cap, never more
    expect(j?.failedReason).toContain("simulated permanent failure");
    const [d] = await t.dead();
    expect(d?.data).toMatchObject({ job: "selftest", jobId: "dead-1", attemptsMade: 3 });
    expect(JSON.stringify(d?.data)).not.toContain("mode"); // payload is never copied into the dead-letter record
    await waitFor(async () => t.f.calls.audits.some((a) => a.action === "job.dead_lettered" && a.target === "dead-1"));
    expect(t.errors).toHaveLength(1); // reported once, not on each retry
    await t.close();
  });

  it("is idempotent: the same job id never creates a second job", async () => {
    const prefix = `t${Date.now()}idem`;
    const p = createProducer(URL, prefix);
    const a = await p.enqueue("selftest", { mode: "ok" }, { jobId: "same-id", delayMs: 60_000 });
    const b = await p.enqueue("selftest", { mode: "ok" }, { jobId: "same-id", delayMs: 60_000 });
    expect(a.jobId).toBe(b.jobId);
    expect((await p.stats())[QUEUES.system]?.delayed).toBe(1);
    await p.close();
  });

  it("rejects bad payloads and bad ids before they reach Redis", async () => {
    const p = createProducer(URL, `t${Date.now()}val`);
    // @ts-expect-error invalid mode on purpose
    await expect(p.enqueue("selftest", { mode: "bogus" })).rejects.toThrow();
    // @ts-expect-error unknown field on purpose (strict schema)
    await expect(p.enqueue("selftest", { mode: "ok", userId: "x" })).rejects.toThrow();
    await expect(p.enqueue("selftest", { mode: "sleep", sleepMs: 99_999_999 })).rejects.toThrow();
    await expect(p.enqueue("selftest", { mode: "ok" }, { jobId: "bad:id" })).rejects.toThrow();
    await expect(p.enqueue("selftest", { mode: "ok" }, { jobId: "12345" })).rejects.toThrow();
    const s = await p.stats();
    expect(Object.values(s).every((c) => Object.values(c).every((n) => n === 0))).toBe(true);
    await p.close();
  });

  it("enforces the time limit: a hung job fails with a timeout instead of running forever", async () => {
    const t = await setup({ timeoutMs: { selftest: 300 } });
    await t.producer.enqueue("selftest", { mode: "sleep", sleepMs: 10_000 }, { jobId: "slow-1", attempts: 1 });
    await waitFor(async () => (await t.state("slow-1")) === "failed", 5000);
    expect((await t.job("slow-1"))?.failedReason).toMatch(/time limit/);
    await t.close();
  });

  it("cancels a running job immediately and does not retry it", async () => {
    const t = await setup();
    await t.producer.enqueue("selftest", { mode: "sleep", sleepMs: 20_000 }, { jobId: "cancel-1" });
    await waitFor(async () => (await t.state("cancel-1")) === "active");
    const r = await t.producer.requestCancel(QUEUES.system, "cancel-1");
    expect(r).toMatchObject({ found: true, state: "active", removed: false });
    await waitFor(async () => (await t.state("cancel-1")) === "failed", 5000);
    const j = await t.job("cancel-1");
    expect(j?.failedReason).toBe("Cancelled by user");
    expect(j?.attemptsMade).toBe(1); // final: no retries after a cancel
    await t.close();
  });

  it("cancelling a waiting job removes it before it ever runs", async () => {
    const prefix = `t${Date.now()}cw`;
    const p = createProducer(URL, prefix);
    await p.enqueue("selftest", { mode: "ok" }, { jobId: "wait-1", delayMs: 60_000 });
    const r = await p.requestCancel(QUEUES.system, "wait-1");
    expect(r).toMatchObject({ found: true, removed: true });
    expect(await p.getQueue(QUEUES.system).getJob("wait-1")).toBeUndefined();
    await p.close();
  });

  it("does not trust Redis: unknown job names and tampered payloads fail at once, without retries", async () => {
    const t = await setup();
    const q = t.producer.getQueue(QUEUES.system);
    await q.add("evil", { cmd: "rm -rf /" }, { jobId: "evil-1", attempts: 3 });
    await q.add("selftest", { mode: "ok", extra: "x" }, { jobId: "tamper-1", attempts: 3 });
    await waitFor(async () => (await t.state("evil-1")) === "failed" && (await t.state("tamper-1")) === "failed");
    expect((await t.job("evil-1"))?.attemptsMade).toBe(1);
    expect((await t.job("tamper-1"))?.attemptsMade).toBe(1);
    await t.close();
  });

  it("recovers a job whose worker was killed mid-run (stalled-job detection)", async () => {
    const prefix = `t${Date.now()}crash`;
    const producer = createProducer(URL, prefix);
    const child = spawn(process.execPath, ["--import", "tsx", "tests/helpers/crashy-worker.ts"], { env: { ...process.env, REDIS_URL: URL, PREFIX: prefix }, stdio: ["ignore", "pipe", "inherit"] });
    await new Promise<void>((res, rej) => { child.stdout!.on("data", (d) => String(d).includes("READY") && res()); child.on("exit", () => rej(new Error("child exited early"))); });
    await producer.enqueue("selftest", { mode: "sleep", sleepMs: 1500 }, { jobId: "crash-1" });
    const q = producer.getQueue(QUEUES.system);
    await waitFor(async () => (await (await q.getJob("crash-1"))?.getState()) === "active");
    child.kill("SIGKILL"); // the worker dies without releasing the job
    const f = fakeDb();
    const runner = await startWorkers({ redisUrl: URL, prefix, db: f.db, log: createLogger(undefined, "silent"), workerId: "rescuer", statusIntervalMs: 0, lockDurationMs: 1000, stalledIntervalMs: 500 });
    await waitFor(async () => (await (await q.getJob("crash-1"))?.getState()) === "completed", 20_000);
    expect((await q.getJob("crash-1"))?.stalledCounter).toBe(1); // lost once (worker killed), recovered by the rescuer
    await runner.close(); await producer.close();
  }, 40_000);

  it("runs the stuck-job reaper job and audits each reaped job", async () => {
    const t = await setup();
    await t.producer.enqueue("reapStuckJobs", { staleAfterSeconds: 300, maxAttempts: 3 }, { jobId: "reap-1" });
    await waitFor(async () => (await t.state("reap-1")) === "completed");
    expect(t.f.calls.reap).toEqual([[300, 3]]);
    expect(t.f.calls.audits).toContainEqual({ action: "job.reaped", target: "j-lost", meta: { action: "requeued" } });
    expect((await t.job("reap-1"))?.returnvalue).toMatchObject({ reaped: 1 });
    await t.close();
  });

  it("cleanup deletes stored files BEFORE database rows, and keeps the rows if storage fails", async () => {
    const t = await setup();
    t.f.setPending([{ id: "a1", storageKey: "u/p/a1.mp3" }, { id: "a2", storageKey: "u/p/a2.png" }]);
    await t.producer.enqueue("cleanupStaleUploads", { olderThanMinutes: 60, limit: 10 }, { jobId: "clean-1" });
    await waitFor(async () => (await t.state("clean-1")) === "completed");
    expect(t.f.calls.removed).toEqual([["u/p/a1.mp3", "u/p/a2.png"]]);
    expect(t.f.calls.deleted).toEqual([["a1", "a2"]]);
    expect(t.f.calls.order).toEqual(["remove", "delete"]);

    t.f.calls.order.length = 0; t.f.calls.deleted.length = 0; t.f.failRemove(true);
    await t.producer.enqueue("cleanupStaleUploads", { olderThanMinutes: 60, limit: 10 }, { jobId: "clean-2" });
    await waitFor(async () => (await t.state("clean-2")) === "failed");
    expect(t.f.calls.deleted).toHaveLength(0); // rows survive so the next run retries
    await t.close();
  });

  it("registers recurring schedules once, even when the worker restarts", async () => {
    const prefix = `t${Date.now()}sched`;
    const f = fakeDb();
    const mk = () => startWorkers({ redisUrl: URL, prefix, db: f.db, log: createLogger(undefined, "silent"), workerId: "s", statusIntervalMs: 0, schedules: true });
    const r1 = await mk(); await r1.close();
    const r2 = await mk();
    const p = createProducer(URL, prefix);
    const schedulers = await p.getQueue(QUEUES.system).getJobSchedulers();
    expect(schedulers.map((s) => s.key).sort()).toEqual(["cleanup-stale-uploads", "reap-stuck-jobs"]);
    await r2.close(); await p.close();
  });

  it("reports worker liveness to the database", async () => {
    const t = await setup({ statusIntervalMs: 100 });
    await waitFor(async () => t.f.calls.status >= 3);
    await t.close();
  });
});

describe("health endpoints", () => {
  it("liveness is up; readiness reflects dependency health", async () => {
    let redisOk = true;
    const h = createHealthServer({ redis: () => redisOk, database: async () => true }, 0);
    const port = await h.listen();
    const get = (p: string, method = "GET") => fetch(`http://127.0.0.1:${port}${p}`, { method });
    expect((await get("/healthz")).status).toBe(200);
    const ready = await get("/readyz");
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ready", checks: { redis: true, database: true } });
    redisOk = false;
    const notReady = await get("/readyz");
    expect(notReady.status).toBe(503);
    expect(await notReady.json()).toMatchObject({ status: "not_ready", checks: { redis: false, database: true } });
    expect((await get("/nope")).status).toBe(404);
    expect((await get("/healthz", "POST")).status).toBe(405);
    await h.close();
  });
  it("a check that throws counts as not ready (never crashes the server)", async () => {
    const h = createHealthServer({ boom: () => { throw new Error("x"); } }, 0);
    const port = await h.listen();
    expect((await fetch(`http://127.0.0.1:${port}/readyz`)).status).toBe(503);
    await h.close();
  });
});

describe("structured logging", () => {
  it("redacts credentials anywhere they commonly appear", () => {
    const out: string[] = [];
    const log = createLogger({ write: (s: string) => { out.push(s); return true; } } as unknown as NodeJS.WritableStream, "info");
    log.info({ token: "tok-123", nested: { password: "pw-456", apiKey: "key-789" }, headers: { authorization: "Bearer bearer-abc", cookie: "sb=cookie-def" },
      cfg: { SUPABASE_SERVICE_ROLE_KEY: "srk-ghi", REDIS_URL: "redis://:secret-jkl@h:6379" } }, "hello");
    const line = out.join("");
    for (const secret of ["tok-123", "pw-456", "key-789", "bearer-abc", "cookie-def", "srk-ghi", "secret-jkl"]) expect(line).not.toContain(secret);
    expect(line).toContain("[REDACTED]");
    expect(JSON.parse(line)).toMatchObject({ service: "vistoon-worker", msg: "hello" });
    expect(REDACT.length).toBeGreaterThan(5);
  });
  it("contracts: every job has a bounded timeout and retry cap", () => {
    for (const j of Object.values(JOBS)) { expect(j.timeoutMs).toBeGreaterThan(0); expect(j.timeoutMs).toBeLessThanOrEqual(300_000); expect(j.attempts).toBeLessThanOrEqual(5); }
  });
});
