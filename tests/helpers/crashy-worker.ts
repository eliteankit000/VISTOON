// Child process used by the crash test: runs a real worker that the test then kills with SIGKILL.
import { startWorkers } from "../../worker/src/runner";
import { createLogger } from "../../worker/src/logger";
import type { Db } from "../../worker/src/db";

const db: Db = {
  reapStuckJobs: async () => [], staleQueuedJobs: async () => [], stalePendingAssets: async () => [], removeStorage: async () => {},
  deleteAssets: async () => {}, recordAudit: async () => {}, recordUsage: async () => {}, upsertWorkerStatus: async () => {}, ping: async () => true,
};
(async () => {
  await startWorkers({ redisUrl: process.env.REDIS_URL!, prefix: process.env.PREFIX, db, log: createLogger(undefined, "silent"), workerId: "crashy",
    lockDurationMs: 1000, stalledIntervalMs: 500, statusIntervalMs: 0 });
  console.log("READY");
  setInterval(() => undefined, 1000);
})();
