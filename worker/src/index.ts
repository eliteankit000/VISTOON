import { hostname } from "node:os";
import { z } from "zod";
import { supabaseDb } from "./db";
import { createHealthServer } from "./health";
import { createLogger } from "./logger";
import { startWorkers } from "./runner";

const env = z.object({
  REDIS_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  WORKER_PORT: z.coerce.number().int().min(0).max(65535).default(8080),
  WORKER_HOST: z.string().default("127.0.0.1"), // bind wider (0.0.0.0) only inside a private network
  WORKER_ID: z.string().default(`${hostname()}-${process.pid}`),
}).safeParse(process.env);

const log = createLogger();
if (!env.success) {
  log.fatal({ missing: env.error.issues.map((i) => i.path.join(".")) }, "invalid worker configuration");
  process.exit(1);
}
const cfg = env.data;
const db = supabaseDb(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);

const runner = await startWorkers({ redisUrl: cfg.REDIS_URL, db, log, workerId: cfg.WORKER_ID, schedules: true });
const health = createHealthServer({
  redis: async () => (await runner.redis.ping()) === "PONG",
  worker: () => runner.ready(),
  database: () => db.ping(),
}, cfg.WORKER_PORT, cfg.WORKER_HOST);
const port = await health.listen();
log.info({ port }, "health server listening");

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, "shutting down: finishing current jobs");
  const force = setTimeout(() => { log.error("forced exit after 60 s"); process.exit(1); }, 60_000);
  await runner.close();
  await health.close();
  clearTimeout(force);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (e) => log.error({ err: e }, "unhandled rejection"));
