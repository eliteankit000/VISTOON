/**
 * Turn pasted text or an uploaded .txt/.srt/.vtt file into plain transcript text.
 * Removes BOM, control characters, WEBVTT headers, cue numbers, timestamps and markup tags.
 * Output is plain text only; it is always rendered as text, never as HTML.
 */
export function cleanTranscript(raw: string): string {
  let t = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "");
  const lines = t.split("\n").filter((l) => {
    const s = l.trim();
    if (/^WEBVTT\b/i.test(s) || /^(NOTE|STYLE|REGION)\b/.test(s)) return false;
    if (/^\d+$/.test(s)) return false; // SRT cue number
    if (/^(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3}/.test(s)) return false;
    return true;
  });
  t = lines.join("\n").replace(/<[^>]{0,200}>/g, "").replace(/&nbsp;/g, " ");
  return t.normalize("NFC").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export type Lang = "en" | "hi" | "hinglish" | "unknown";
/** Rough script-based guess. Roman-script Hindi (Hinglish) cannot be reliably told from English without a model, so it is only suggested when common Hinglish words appear. */
export function detectLanguage(t: string): Lang {
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (letters < 20) return "unknown";
  const dev = (t.match(/[ऀ-ॿ]/g) ?? []).length;
  if (dev / letters > 0.4) return "hi";
  const hin = (t.toLowerCase().match(/\b(hai|hain|nahi|kya|aur|yeh|ye|toh|bhi|kuch|mein|ko|ka|ki|ke|tha|thi|hum|aap|kaise|lekin)\b/g) ?? []).length;
  const words = (t.match(/\p{L}+/gu) ?? []).length;
  return hin / Math.max(words, 1) > 0.06 ? "hinglish" : "en";
}
