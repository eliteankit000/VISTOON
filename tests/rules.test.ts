import { describe, it, expect } from "vitest";
import { safeRedirect, passwordProblem, adminAccess, isPublicPath } from "../src/lib/auth/rules";
import { canTransition } from "../src/lib/styles-lifecycle";

describe("safeRedirect", () => {
  it("allows normal relative paths", () => expect(safeRedirect("/projects/1")).toBe("/projects/1"));
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/a\nb", ""])("blocks %j", (v) =>
    expect(safeRedirect(v)).toBe("/dashboard"));
  it("falls back for null", () => expect(safeRedirect(null)).toBe("/dashboard"));
});
describe("passwordProblem", () => {
  it("rejects short", () => expect(passwordProblem("short")).not.toBeNull());
  it("rejects repeated char", () => expect(passwordProblem("aaaaaaaaaaaaaa")).not.toBeNull());
  it("accepts a long passphrase", () => expect(passwordProblem("correct horse battery")).toBeNull());
});
describe("adminAccess", () => {
  it("401 when signed out", () => expect(adminAccess(null, null, null)).toMatchObject({ ok: false, status: 401 }));
  it("403 for normal user", () => expect(adminAccess({ id: "u" }, "user", "aal2")).toMatchObject({ ok: false, status: 403 }));
  it("403 for admin without MFA", () => expect(adminAccess({ id: "u" }, "admin", "aal1")).toMatchObject({ ok: false, status: 403, reason: "MFA required" }));
  it("ok for admin with MFA", () => expect(adminAccess({ id: "u" }, "admin", "aal2")).toEqual({ ok: true }));
});
describe("isPublicPath", () => {
  it("protects app routes", () => { expect(isPublicPath("/dashboard")).toBe(false); expect(isPublicPath("/admin")).toBe(false); expect(isPublicPath("/api/admin/styles")).toBe(false); });
  it("allows login", () => expect(isPublicPath("/login")).toBe(true));
});
describe("style lifecycle", () => {
  it("blocks skipping steps", () => expect(canTransition("draft", "published", true).ok).toBe(false));
  it("blocks publish without a verified version", () => expect(canTransition("verified", "published", false).ok).toBe(false));
  it("allows publish with verified version", () => expect(canTransition("verified", "published", true).ok).toBe(true));
});
