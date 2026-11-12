import { describe, it, expect } from "vitest";
import { normalizeMime, validateUploadRequest, sniffMime, sniffMatches, sanitizeName, buildStorageKey, MB } from "../src/lib/uploads/rules";
import { sameOrigin } from "../src/lib/api";

const bytes = (...n: number[]) => { const a = new Uint8Array(32); a.set(n); return a; };
const withAscii = (at: number, s: string, base = new Uint8Array(32)) => { [...s].forEach((c, i) => (base[at + i] = c.charCodeAt(0))); return base; };

describe("validateUploadRequest", () => {
  it("accepts mp3 voiceover and normalises aliases", () => {
    expect(validateUploadRequest("voiceover", "audio/mp3", 1000)).toMatchObject({ ok: true, mime: "audio/mpeg" });
    expect(validateUploadRequest("voiceover", "audio/x-wav", 1000)).toMatchObject({ ok: true, mime: "audio/wav" });
  });
  it.each([["application/x-msdownload"], ["text/html"], ["image/svg+xml"], ["application/zip"], ["video/mp4"]])("rejects %s as a voiceover", (m) =>
    expect(validateUploadRequest("voiceover", m, 1000).ok).toBe(false));
  it("rejects SVG and HTML as references (script-capable)", () => {
    expect(validateUploadRequest("reference", "image/svg+xml", 10).ok).toBe(false);
    expect(validateUploadRequest("reference", "text/html", 10).ok).toBe(false);
  });
  it("enforces per-type size limits", () => {
    expect(validateUploadRequest("reference", "image/png", 10 * MB).ok).toBe(true);
    expect(validateUploadRequest("reference", "image/png", 10 * MB + 1).ok).toBe(false);
    expect(validateUploadRequest("voiceover", "audio/mpeg", 50 * MB + 1).ok).toBe(false);
  });
  it.each([0, -5, 1.5, NaN])("rejects bad size %s", (n) => expect(validateUploadRequest("voiceover", "audio/mpeg", n).ok).toBe(false));
  it("normalizeMime ignores parameters and case", () => expect(normalizeMime("Audio/MPEG; charset=x")).toBe("audio/mpeg"));
});

describe("sniffMime (real file signatures)", () => {
  it("png", () => expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png"));
  it("jpeg", () => expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg"));
  it("webp", () => expect(sniffMime(withAscii(8, "WEBP", withAscii(0, "RIFF")))).toBe("image/webp"));
  it("wav", () => expect(sniffMime(withAscii(8, "WAVE", withAscii(0, "RIFF")))).toBe("audio/wav"));
  it("mp3 with ID3", () => expect(sniffMime(withAscii(0, "ID3"))).toBe("audio/mpeg"));
  it("mp3 frame sync", () => expect(sniffMime(bytes(0xff, 0xfb, 0x90, 0x00))).toBe("audio/mpeg"));
  it("webm", () => expect(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("video/webm"));
  it("mp4 family", () => expect(sniffMime(withAscii(4, "ftypisom"))).toBe("mp4-family"));
  it("rejects a Windows executable renamed to .mp3", () => expect(sniffMime(withAscii(0, "MZ\u0090"))).toBeNull());
  it("rejects HTML/script content", () => expect(sniffMime(withAscii(0, "<html><script>"))).toBeNull());
  it("rejects too-short input", () => expect(sniffMime(new Uint8Array(4))).toBeNull());
});

describe("sniffMatches", () => {
  it("must agree with the declared type", () => {
    expect(sniffMatches("audio/mpeg", "audio/mpeg")).toBe(true);
    expect(sniffMatches("audio/mpeg", "image/png")).toBe(false); // PNG uploaded as an mp3
    expect(sniffMatches("audio/mpeg", null)).toBe(false);
  });
  it("mp4 container satisfies audio/mp4 and video/mp4 only", () => {
    expect(sniffMatches("audio/mp4", "mp4-family")).toBe(true);
    expect(sniffMatches("video/mp4", "mp4-family")).toBe(true);
    expect(sniffMatches("audio/mpeg", "mp4-family")).toBe(false);
  });
});

describe("names and keys", () => {
  it("strips paths and control chars from display names", () => {
    expect(sanitizeName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeName("C:\\x\\evil<script>.mp3")).toBe("evilscript.mp3");
    expect(sanitizeName("\u0000\u0001")).toBe("file");
  });
  it("storage key is server-built and extension comes from the verified mime", () => {
    const k = buildStorageKey("u1", "p1", "a1", "audio/mpeg");
    expect(k).toBe("u1/p1/a1.mp3");
    expect(() => buildStorageKey("u", "p", "a", "text/html")).toThrow();
  });
});

describe("CSRF origin check", () => {
  it("allows same host", () => expect(sameOrigin("https://app.example.com", "app.example.com")).toBe(true));
  it("blocks other hosts, missing and malformed origins", () => {
    expect(sameOrigin("https://evil.com", "app.example.com")).toBe(false);
    expect(sameOrigin(null, "app.example.com")).toBe(false);
    expect(sameOrigin("not a url", "app.example.com")).toBe(false);
    expect(sameOrigin("https://app.example.com.evil.com", "app.example.com")).toBe(false);
  });
});
