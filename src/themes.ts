/**
 * Tags a market headline with the broad themes that tend to move prices together, so an unusual
 * price move can be shown next to what the news was talking about. This is keyword matching, not
 * understanding: a theme appearing near a move is a lead to check, never proof of cause.
 */
export type ThemeId = "ai-spending" | "oil-geopolitics" | "rates-inflation" | "china-trade" | "earnings";

interface ThemeDef {
  id: ThemeId;
  label: string;
  re: RegExp;
}

export const THEMES: readonly ThemeDef[] = [
  {
    id: "ai-spending",
    label: "AI spending",
    re: /AI (?:spending|capex|bubble|trade|doubts?|buildout|build-out|investment|boom)|capex|capital (?:expenditure|spending)|hyperscaler|chip(?:maker)?s? sell-?off|semiconductor sell-?off|data cent(?:er|re)s? (?:spending|build)/i,
  },
  {
    id: "oil-geopolitics",
    label: "Oil & geopolitics",
    re: /\boil\b|\bcrude\b|\bbrent\b|\bWTI\b|\bOPEC\b|\bIran\b|\bHouthi|Strait of Hormuz|\bSaudi\b|Middle East|\bIsrael\b|\bUkraine\b|\bRussia\b|Taiwan Strait/i,
  },
  {
    id: "rates-inflation",
    label: "Rates & inflation",
    re: /\bFed\b|Federal Reserve|rate (?:hike|cut|rise|decision)s?|interest rates?|treasury yields?|bond yields?|10-year|inflation|\bCPI\b|\bPCE\b|\bPowell\b|\bFOMC\b/i,
  },
  {
    id: "china-trade",
    label: "China & trade policy",
    re: /\bChina\b|\bBeijing\b|\bPBOC\b|CSI 300|Hang Seng|stimulus|\btariffs?\b|export (?:controls?|curbs?|restrictions?)|trade war/i,
  },
  {
    id: "earnings",
    label: "Earnings",
    re: /\bearnings\b|quarterly results|\bguidance\b|beats? (?:estimates|expectations)|misses? (?:estimates|expectations)|profit warning|revenue forecast/i,
  },
];

export function tagThemes(text: string): ThemeId[] {
  return THEMES.filter((t) => t.re.test(text)).map((t) => t.id);
}

export const themeLabel = (id: ThemeId): string => THEMES.find((t) => t.id === id)?.label ?? id;
