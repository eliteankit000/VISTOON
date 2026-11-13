import pino, { type Logger } from "pino";

// Never let credentials reach logs, even if a payload or error object carries them by accident.
export const REDACT = [
  "token", "password", "authorization", "apiKey", "api_key", "serviceRoleKey", "SUPABASE_SERVICE_ROLE_KEY", "REDIS_URL",
  "*.token", "*.password", "*.authorization", "*.apiKey", "*.api_key", "*.serviceRoleKey", "*.SUPABASE_SERVICE_ROLE_KEY", "*.REDIS_URL",
  "headers.authorization", "headers.cookie", "*.headers.authorization", "*.headers.cookie",
];
export function createLogger(stream?: NodeJS.WritableStream, level = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino({ level, base: { service: "vistoon-worker" }, redact: { paths: REDACT, censor: "[REDACTED]" }, timestamp: pino.stdTimeFunctions.isoTime }, stream);
}
export type { Logger };
