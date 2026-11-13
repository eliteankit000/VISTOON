/**
 * Word counting policy "words-v1" (documented; exact-length enforcement and character policy come on Day 9):
 * a word is a maximal run of letters, combining marks or digits (any script, so Devanagari works), and may contain
 * internal apostrophes or hyphens ("don't", "well-known" = 1 word). Punctuation alone is not a word.
 */
export const WORD_POLICY = "words-v1";
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;
export const countWords = (s: string) => (s.match(WORD) ?? []).length;
