import { z } from "zod";

export const jsonError = (error: string, status: number) => Response.json({ error }, { status });

/** CSRF defence for cookie-authenticated mutations: the browser's Origin must match this host. */
export function sameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
export function csrfGuard(request: Request): Response | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return sameOrigin(request.headers.get("origin"), host) ? null : jsonError("Cross-origin request blocked", 403);
}

export const uuid = z.string().uuid();
export async function readJson<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T> | null> {
  const text = await request.text().catch(() => "");
  if (text.length > 10_000) return null; // request size limit for JSON bodies
  try { const r = schema.safeParse(JSON.parse(text)); return r.success ? r.data : null; } catch { return null; }
}

/** Map database trigger errors to friendly, non-leaky API errors. */
export function dbError(message: string | undefined): Response {
  if (message?.includes("project_limit_reached")) return jsonError("Project limit reached for your plan.", 403);
  if (message?.includes("storage_quota_exceeded")) return jsonError("Storage quota exceeded for your plan.", 403);
  if (message?.includes("too_many_pending_uploads")) return jsonError("Too many unfinished uploads. Finish or wait, then try again.", 429);
  return jsonError("Request failed.", 500);
}
