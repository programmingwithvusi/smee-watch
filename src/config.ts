/**
 * Everything you're likely to tweak lives here.
 * Secrets never go in this file: they come from environment variables.
 */

export interface NewsQuery {
  label: string;
  q: string;
  hl: string;
  gl: string;
  ceid: string;
}

export interface PageSource {
  name: string;
  url: string;
  /** Text a healthy, fully-loaded page always contains; its absence counts as a failure. */
  expectText?: string;
}

export interface WatchSymbol {
  symbol: string; // Yahoo Finance symbol
  label: string;
  moveAlertPct: number; // alert when |day change| >= this; re-alerts at each multiple
}

// Google News RSS queries. Chinese queries catch domestic reporting first.
const ZH = { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" } as const;
const EN = { hl: "en-US", gl: "US", ceid: "US:en" } as const;

export const NEWS_QUERIES: NewsQuery[] = [
  { label: "zh: 上海微电子 上市", q: "上海微电子 上市", ...ZH },
  { label: "zh: 上海微电子 借壳", q: "上海微电子 借壳", ...ZH },
  { label: "zh: 上海微电子 IPO 辅导", q: "上海微电子 IPO 辅导", ...ZH },
  { label: "zh: 芯上微装", q: "芯上微装", ...ZH },
  { label: "en: SMEE IPO", q: '"Shanghai Micro Electronics" IPO OR listing', ...EN },
  { label: "en: SMEE reverse merger", q: '"Shanghai Micro Electronics" reverse merger', ...EN },
];

/**
 * Pages rendered in a real browser. Every line mentioning SMEE/AMIES on these pages is an alert,
 * and a change in the 3 lines that follow it (status columns) re-alerts.
 *
 * TODO(you): add the CSRC tutoring-filing (辅导备案) page and cninfo once you've confirmed the URLs
 * open from a browser. Keep the list short: each page costs a browser navigation per run.
 */
/**
 * Catalyst news: policy and technology moves that tend to hit ASML/SMIC before the price fully
 * reacts. Every hit here is already narrowly targeted, so classifyCatalyst just needs entity +
 * catalyst vocabulary (see src/catalystClassify.ts) — there's no "low" tier to suppress.
 */
export const CATALYST_QUERIES: NewsQuery[] = [
  { label: "en: ASML export controls", q: "ASML export control OR export licence China", ...EN },
  { label: "en: ASML Dutch government", q: "ASML Dutch government OR Netherlands government restriction", ...EN },
  { label: "en: chip export controls China", q: "semiconductor export control China Commerce Department", ...EN },
  { label: "en: SMIC entity list OR sanctions", q: "SMIC entity list OR sanctions OR blacklist", ...EN },
  { label: "en: SMIC capacity OR breakthrough", q: "SMIC advanced node OR breakthrough OR capacity expansion", ...EN },
  { label: "zh: 中芯国际 制裁 实体清单", q: "中芯国际 制裁 OR 实体清单", ...ZH },
  { label: "zh: 阿斯麦 出口管制", q: "阿斯麦 出口管制 OR 限制", ...ZH },
];

export const PAGES: PageSource[] = [
  {
    name: "SSE IPO review status",
    url: "https://www.sse.com.cn/listing/renewal/ipo/",
    expectText: "科创板", // verify on first run; see README
  },
];

export const WATCHLIST: WatchSymbol[] = [
  { symbol: "ASML", label: "ASML (Nasdaq)", moveAlertPct: 3 },
  { symbol: "ASML.AS", label: "ASML (Amsterdam)", moveAlertPct: 3 },
  { symbol: "688981.SS", label: "SMIC A-share (STAR)", moveAlertPct: 4 },
  { symbol: "0981.HK", label: "SMIC H-share (HKEX)", moveAlertPct: 4 },
];

export const FX_SYMBOL = "CNYHKD=X"; // HKD per 1 CNY, used for the SMIC A/H premium
export const SMIC_A = "688981.SS";
export const SMIC_H = "0981.HK";

/** Consecutive failures before we tell you a source has gone quiet. */
export const FAIL_ALERT_AFTER = 6;

/** Minimum rendered text length before we trust a page (blocked/empty pages are tiny). */
export const MIN_PAGE_TEXT = 300;

export const SEEN_RETENTION_DAYS = 120;

// ---------------------------------------------------------------------------------------------
// Earnings calendar: the highest-probability volatility windows. A reminder fires this many days
// before each date (including 0 = the day itself). Dates marked confirmed: false are estimates —
// they follow the company's usual reporting cadence but have not been officially announced yet,
// so double-check them closer to the time and update this file if the real date differs.
// ---------------------------------------------------------------------------------------------
export interface EarningsEvent {
  id: string;
  company: "ASML" | "SMIC";
  label: string;
  /** ISO date, UTC, no time — the calendar day the results are due */
  date: string;
  confirmed: boolean;
  source: string;
}

export const EARNINGS: EarningsEvent[] = [
  {
    id: "asml-q3-2026",
    company: "ASML",
    label: "ASML Q3 2026 results",
    date: "2026-10-14",
    confirmed: true,
    source: "https://www.asml.com/en/investors/financial-results",
  },
  {
    id: "smic-q3-2026",
    company: "SMIC",
    label: "SMIC Q3 2026 results",
    date: "2026-11-12",
    confirmed: false, // estimate from SMIC's usual reporting cadence (Q2 2026 was reported Aug 13); not yet announced
    source: "https://www.smics.com/en/site/company_financialSummary",
  },
];

/** Days-before-the-event a reminder fires, each exactly once (state/earnings.json tracks which). */
export const EARNINGS_REMINDER_DAYS_BEFORE = [7, 3, 1, 0];

// ---------------------------------------------------------------------------------------------
// Volatility widening: alerts when a symbol's move today is unusually large next to its own
// recent daily moves, even if it doesn't clear the fixed moveAlertPct threshold above.
// ---------------------------------------------------------------------------------------------
export const VOLATILITY_MULTIPLIER = 1.8;
/** Skip symbols whose recent daily moves have been near-flat; avoids flagging a 0.3% day as "3x normal". */
export const VOLATILITY_MIN_AVG_PCT = 0.3;
/** Skip tiny absolute moves even if they're technically a multiple of a very calm baseline. */
export const VOLATILITY_MIN_MOVE_PCT = 1;
export const VOLATILITY_LOOKBACK_DAYS = 5;
