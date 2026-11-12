// Pure, unit-tested security rules (no framework imports).

/** Only same-site relative paths are allowed after login; blocks open redirects like //evil.com or /\evil.com. */
export function safeRedirect(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

export const PASSWORD_MIN = 12;
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (pw.length > 128) return "Use at most 128 characters.";
  if (/^(.)\1+$/.test(pw)) return "Choose a less repetitive password.";
  return null;
}

export const PUBLIC_PATHS = ["/", "/login", "/signup", "/reset", "/auth/callback"];
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path);
}

export type Role = "user" | "admin";
export type Access = { ok: true } | { ok: false; status: 401 | 403; reason: string };
/** Admin access = signed in + admin role + MFA-verified session (aal2). */
export function adminAccess(user: { id: string } | null, role: Role | null, aal: string | null): Access {
  if (!user) return { ok: false, status: 401, reason: "Not signed in" };
  if (role !== "admin") return { ok: false, status: 403, reason: "Forbidden" };
  if (aal !== "aal2") return { ok: false, status: 403, reason: "MFA required" };
  return { ok: true };
}
