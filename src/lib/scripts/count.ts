/**
 * Counting policies (deterministic, run on the server and in the editor with the same code).
 *
 * words-v1: a word is a maximal run of letters, combining marks or digits (any script, so Devanagari works),
 *   optionally joined by internal apostrophes or hyphens ("don't", "well-known" = 1 word). Punctuation alone is not a word.
 *
 * NOTE: grapheme segmentation comes from the runtime's Unicode data (ICU), which can differ slightly between Node/browser
 *   versions for rare scripts. The SERVER count is authoritative: the editor shows a live estimate, and the saved version
 *   and the "exact" verdict always use the server's count.
 *
 * chars-v1: "characters with spaces". The text is Unicode-normalised (NFC), line endings are unified, leading and
 *   trailing whitespace is ignored, and every user-perceived character (grapheme cluster) counts once, including
 *   spaces and punctuation. A line break counts as ONE character. A Devanagari conjunct such as "क्ष" is one
 *   character; an emoji with modifiers is one character.
 */
export const WORD_POLICY = "words-v1";
export const CHAR_POLICY = "chars-v1";
export type CountType = "words" | "chars";

const WORD = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;
export const countWords = (s: string) => (s.match(WORD) ?? []).length;

const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
export function countChars(s: string): number {
  const t = s.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!seg) return Array.from(t).length;
  let n = 0; for (const _ of seg.segment(t)) n++;
  return n;
}

export const policyFor = (t: CountType) => (t === "words" ? WORD_POLICY : CHAR_POLICY);
export const countBy = (t: CountType, s: string) => (t === "words" ? countWords(s) : countChars(s));

export type LengthCheck = { ok: boolean; actual: number; target: number; delta: number; status: "exact" | "over" | "under" };
/** delta = actual - target (positive means too long). */
export function checkLength(text: string, type: CountType, target: number): LengthCheck {
  const actual = countBy(type, text), delta = actual - target;
  return { ok: delta === 0, actual, target, delta, status: delta === 0 ? "exact" : delta > 0 ? "over" : "under" };
}
