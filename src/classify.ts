/**
 * Entity match: is this about SMEE (or its spin-off AMIES / 芯上微装)?
 * Deliberately exact: 芯碁微装 (688630, a different, already-listed company) does NOT match 芯上微装.
 */
const ENTITY_NAME_RE = /上海微电子|芯上微装|Shanghai Micro[\s-]*Electronics/i;
/** Acronyms are case-sensitive so "Smee" (Peter Pan) or "Amies" (a surname) don't trigger alerts. */
const ENTITY_ACRONYM_RE = /\b(?:SMEE|AMIES)\b/;

/** Listing-process vocabulary: IPO stages, reverse-merger and suspension language. */
const SIGNAL_RE =
  /上市|IPO|辅导|借壳|重组|停牌|科创板|递交|受理|问询|注册生效|招股|申购|listing|listed|go(?:ing)? public|reverse (?:merger|takeover)|prospectus|tutoring|STAR Market/i;

export type Level = "high" | "low" | "none";

export function mentionsEntity(text: string): boolean {
  return ENTITY_NAME_RE.test(text) || ENTITY_ACRONYM_RE.test(text);
}

export function classify(text: string): Level {
  if (!mentionsEntity(text)) return "none";
  return SIGNAL_RE.test(text) ? "high" : "low";
}
