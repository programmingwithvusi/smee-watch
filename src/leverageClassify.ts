/**
 * AI-leverage news: signals that Anthropic or OpenAI is becoming reachable by an ordinary investor
 * -- an IPO, a public listing, or secondary-market trading restrictions easing -- since neither
 * company can be bought directly today (see the money-and-wealth discussion, 2026-10-12). Like
 * catalystClassify, a hit here is already narrowly targeted by the search query, so entity +
 * vocabulary match alone is "high"; nothing is "low".
 */
const ENTITY_RE = /\bAnthropic\b|\bOpenAI\b/i;

const SIGNAL_RE =
  /\bIPO\b|initial public offering|public listing|go(?:ing)? public|direct listing|\bS-1\b|SEC filing|secondary market|tender offer|share sale|restriction(?:s)? (?:lifted|eased)|allow(?:s|ed)? (?:secondary|employee) (?:sales|trading)/i;

export type LeverageLevel = "high" | "none";

export function classifyLeverage(text: string): LeverageLevel {
  return ENTITY_RE.test(text) && SIGNAL_RE.test(text) ? "high" : "none";
}
