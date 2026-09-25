/**
 * Catalyst news: things that tend to move ASML or SMIC before the price fully reacts —
 * export-control policy, licensing decisions, sanctions, and major capacity/technology moves.
 * Unlike the SMEE watcher (which waits for entity + listing vocabulary), a hit here is already
 * narrowly targeted by the search query, so entity match alone is "high"; nothing is "low".
 */
const ENTITY_RE =
  /\bASML\b|\bSMIC\b|中芯国际|阿斯麦|Shanghai Micro[\s-]*Electronics|上海微电子|semiconductor equipment|chip equipment|lithography/i;

const CATALYST_RE =
  /export (?:control|licen[cs]e|ban|restriction)|entity list|sanction|blacklist|denied party|BIS rule|Commerce Department|Dutch government|Netherlands government|Wassenaar|EUV|DUV|advanced node|export tutoring|chip war|tariff|capacity expansion|breakthrough|出口管制|实体清单|制裁|拉黑|限制|突破|关税/i;

export type CatalystLevel = "high" | "none";

export function classifyCatalyst(text: string): CatalystLevel {
  return ENTITY_RE.test(text) && CATALYST_RE.test(text) ? "high" : "none";
}
