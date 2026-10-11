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

  // 中旗新材 (001212.SZ) is NOT a confirmed SMEE vehicle. Its controlling shareholder changed in
  // April 2025 to 贺荣明 (via 星空科技), who is reported to have a lithography-industry background --
  // which the market read as a precursor to an SMEE reverse merger, driving several limit-up days.
  // Independent analysis (Eastmoney Caifuhao, Aug 2026) called that baseless: no business synergy
  // (中旗新材 makes artificial stone/construction materials), a poor shell fit, and no link beyond
  // one executive's past employer. Tracked here only to catch the NEXT wave of this specific rumor
  // resurfacing -- a hit is a reason to re-verify, not a reason to act.
  { label: "zh: 中旗新材 光刻机 借壳 (unconfirmed rumor)", q: "中旗新材 光刻机 OR 借壳 上海微电子", ...ZH },
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

/**
 * Future trades you're watching, in your order of interest. Same move alerts as above, plus their
 * own section in the daily digest. Thresholds follow how much each one normally moves: a 3% day is
 * news for Microsoft and routine for Oklo. The unusual-move check (src/volatility.ts) still catches
 * a loud day below the threshold. Keep in step with WATCH_IDEAS in dashboard/shared/watchlist.ts.
 */
export const WATCH_IDEAS: WatchSymbol[] = [
  { symbol: "NVDA", label: "NVIDIA (artificial intelligence)", moveAlertPct: 4 },
  { symbol: "VST", label: "Vistra (data centre power)", moveAlertPct: 5 },
  { symbol: "ROK", label: "Rockwell Automation (robotics)", moveAlertPct: 4 },
  { symbol: "IONQ", label: "IonQ (quantum computing)", moveAlertPct: 7 },
  { symbol: "ENPH", label: "Enphase Energy (clean energy tech)", moveAlertPct: 5 },
  { symbol: "CRWD", label: "CrowdStrike (cybersecurity)", moveAlertPct: 4 },
  { symbol: "MSFT", label: "Microsoft (next-gen cloud)", moveAlertPct: 3 },
  { symbol: "TSM", label: "TSMC (advanced chips)", moveAlertPct: 4 },
  { symbol: "SOFI", label: "SoFi (fintech)", moveAlertPct: 5 },
  { symbol: "OKLO", label: "Oklo (nuclear energy)", moveAlertPct: 7 },
  { symbol: "AVGO", label: "Broadcom (AI infrastructure)", moveAlertPct: 4 },
  { symbol: "RKLB", label: "Rocket Lab (space technology)", moveAlertPct: 7 },
  { symbol: "MU", label: "Micron (high-bandwidth memory)", moveAlertPct: 4 },
  { symbol: "SPCX", label: "SpaceX (space exploration)", moveAlertPct: 5 },
  { symbol: "MRNA", label: "Moderna (mRNA medicines)", moveAlertPct: 5 },
  // Mariana Oncology has no listing of its own: Novartis owns it. A large pharma, so 3% is a big day
  { symbol: "NVS", label: "Novartis (cancer therapy, owns Mariana Oncology)", moveAlertPct: 3 },
];

/**
 * JSE-listed ETFs, bought in rand: the same themes as WATCH_IDEAS without converting to dollars.
 * Funds move less than single stocks, so the thresholds are lower. Keep in step with WATCH_ETFS in
 * dashboard/shared/watchlist.ts.
 */
export const WATCH_ETFS: WatchSymbol[] = [
  { symbol: "STXNDQ.JO", label: "Satrix Nasdaq 100", moveAlertPct: 3 },
  { symbol: "ETF5IT.JO", label: "1nvest S&P 500 Info Tech", moveAlertPct: 3 },
  { symbol: "IVYAI.JO", label: "Ivy EasyETFs AI Innovation", moveAlertPct: 4 },
  { symbol: "EASYAI.JO", label: "EasyETFs AI World", moveAlertPct: 4 },
  { symbol: "STX500.JO", label: "Satrix S&P 500", moveAlertPct: 3 },
  { symbol: "STXWDM.JO", label: "Satrix MSCI World", moveAlertPct: 3 },
  { symbol: "STX40.JO", label: "Satrix 40", moveAlertPct: 3 },
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
  company:
    | "ASML"
    | "SMIC"
    | "ENPH"
    | "NVDA"
    | "VST"
    | "ROK"
    | "IONQ"
    | "CRWD"
    | "MSFT"
    | "TSM"
    | "SOFI"
    | "OKLO"
    | "AVGO"
    | "RKLB"
    | "MU"
    | "MRNA"
    | "NVS";
  label: string;
  /** ISO date, UTC, no time — the calendar day the results are due */
  date: string;
  confirmed: boolean;
  source: string;
}

/** Which Yahoo symbol(s) react when this company reports. Add an entry here whenever you add a new
 * value to EarningsEvent["company"] above. */
export const EARNINGS_REACTION_SYMBOLS: Record<EarningsEvent["company"], string[]> = {
  ASML: ["ASML", "ASML.AS"],
  SMIC: ["688981.SS", "0981.HK"],
  ENPH: ["ENPH"],
  NVDA: ["NVDA"],
  VST: ["VST"],
  ROK: ["ROK"],
  IONQ: ["IONQ"],
  CRWD: ["CRWD"],
  MSFT: ["MSFT"],
  TSM: ["TSM"],
  SOFI: ["SOFI"],
  OKLO: ["OKLO"],
  AVGO: ["AVGO"],
  RKLB: ["RKLB"],
  MU: ["MU"],
  MRNA: ["MRNA"],
  NVS: ["NVS"],
};

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
  {
    id: "enph-q3-2026",
    company: "ENPH",
    label: "Enphase Energy (ENPH) Q3 2026 results",
    date: "2026-10-27",
    confirmed: true,
    source: "https://www.globenewswire.com/news-release/2026/10/06/3375409/0/en/enphase-energy-announces-conference-call-to-review-third-quarter-2026-financial-results.html",
  },

  // --- WATCH_IDEAS earnings. Dates marked confirmed: false are estimated from each company's own
  // cadence last year/quarter (not a generic guess) -- re-check closer to the time and correct if
  // the real date differs. SpaceX (SPCX) is private and has no public earnings, so it's excluded.
  {
    id: "tsm-q3-2026",
    company: "TSM",
    label: "TSMC (TSM) Q3 2026 results",
    date: "2026-10-15",
    confirmed: true,
    source: "https://investor.tsmc.com/quarterly-results",
  },
  {
    id: "nvs-q3-2026",
    company: "NVS",
    label: "Novartis (NVS) Q3 2026 results",
    date: "2026-10-27",
    confirmed: true,
    source: "https://www.novartis.com/investors/financial-data/quarterly-results",
  },
  {
    id: "vst-q3-2026",
    company: "VST",
    label: "Vistra (VST) Q3 2026 results",
    date: "2026-11-06",
    confirmed: true,
    source: "https://investor.vistracorp.com",
  },
  {
    id: "sofi-q3-2026",
    company: "SOFI",
    label: "SoFi (SOFI) Q3 2026 results",
    date: "2026-10-27",
    confirmed: false, // estimate: Q3 2025 was reported Oct 28, 2025
    source: "https://investors.sofi.com",
  },
  {
    id: "msft-q1-fy2027",
    company: "MSFT",
    label: "Microsoft (MSFT) fiscal Q1 2027 results",
    date: "2026-10-28",
    confirmed: false, // estimate: fiscal Q1 2026 was reported Oct 29, 2025
    source: "https://www.microsoft.com/en-us/investor",
  },
  {
    id: "rklb-q3-2026",
    company: "RKLB",
    label: "Rocket Lab (RKLB) Q3 2026 results",
    date: "2026-11-09",
    confirmed: false, // estimate: Q3 2025 was reported Nov 10, 2025
    source: "https://investors.rocketlabcorp.com",
  },
  {
    id: "mrna-q3-2026",
    company: "MRNA",
    label: "Moderna (MRNA) Q3 2026 results",
    date: "2026-11-05",
    confirmed: false, // estimate: Q3 2025 was reported Nov 6, 2025
    source: "https://investors.modernatx.com",
  },
  {
    id: "rok-q4-fy2026",
    company: "ROK",
    label: "Rockwell Automation (ROK) fiscal Q4 2026 results",
    date: "2026-11-05",
    confirmed: false, // estimate: fiscal Q4 2025 was reported Nov 6, 2025
    source: "https://www.rockwellautomation.com/en-us/company/news/press-releases.html",
  },
  {
    id: "ionq-q3-2026",
    company: "IONQ",
    label: "IonQ (IONQ) Q3 2026 results",
    date: "2026-11-04",
    confirmed: false, // estimate: Q3 2025 was reported Nov 5, 2025
    source: "https://ionq.com/news",
  },
  {
    id: "oklo-q3-2026",
    company: "OKLO",
    label: "Oklo (OKLO) Q3 2026 results",
    date: "2026-11-06",
    confirmed: false, // estimate: Q2 2026 was reported Aug 7, 2026
    source: "https://oklo.com/investors",
  },
  {
    id: "nvda-q3-fy2027",
    company: "NVDA",
    label: "NVIDIA (NVDA) fiscal Q3 2027 results",
    date: "2026-11-18",
    confirmed: false, // estimate: fiscal Q3 2026 was reported Nov 19, 2025
    source: "https://investor.nvidia.com",
  },
  {
    id: "crwd-q3-fy2027",
    company: "CRWD",
    label: "CrowdStrike (CRWD) fiscal Q3 2027 results",
    date: "2026-12-01",
    confirmed: false, // estimate: fiscal Q3 2026 was reported Dec 2, 2025
    source: "https://ir.crowdstrike.com",
  },
  {
    id: "avgo-q4-fy2026",
    company: "AVGO",
    label: "Broadcom (AVGO) fiscal Q4 2026 results",
    date: "2026-12-10",
    confirmed: false, // estimate: fiscal Q4 2025 was reported Dec 11, 2025
    source: "https://investors.broadcom.com",
  },
  {
    id: "mu-q1-fy2027",
    company: "MU",
    label: "Micron (MU) fiscal Q1 2027 results",
    date: "2026-12-16",
    confirmed: false, // estimate: fiscal Q1 2026 was reported Dec 17, 2025
    source: "https://investors.micron.com",
  },
];

/** Days-before-the-event a reminder fires, each exactly once (state/earnings.json tracks which). */
export const EARNINGS_REMINDER_DAYS_BEFORE = [7, 3, 1, 0];

/** How many days after the date to keep checking for a real price reaction (see earningsReaction
 * in earnings.ts) before giving up on that event. */
export const EARNINGS_REACTION_WINDOW_DAYS = 3;

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
