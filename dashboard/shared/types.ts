/** Shapes shared by the Netlify function (producer) and the React app (consumer). */

export interface SeriesPoint {
  /** epoch seconds */
  t: number;
  c: number;
}

export type ExchangeId = "NASDAQ" | "NYSE" | "AMS" | "SSE" | "HKEX" | "ASX" | "JSE";
/** "WATCH" is the future-trades watchlist and "ETF" the rand ETFs: many instruments, one section each. */
export type CompanyId = "ASML" | "SMIC" | "WATCH" | "ETF";

export interface QuoteDto {
  symbol: string;
  label: string;
  company: CompanyId;
  exchange: ExchangeId;
  currency: string;
  price: number;
  prevClose: number;
  changePct: number;
  /** epoch seconds of the latest trade Yahoo reports */
  lastTradeAt: number;
  /** ~1 month of daily closes, oldest first */
  series: SeriesPoint[];
}

export interface PremiumDto {
  /** SMIC A-share premium over the H-share, percent */
  current: number;
  /** epoch seconds of the older of the two prices used */
  asOf: number;
  series: SeriesPoint[];
}

/** A currency pair: how many units of the quote currency one unit of the base buys. */
export interface FxDto {
  price: number;
  prevClose: number;
  changePct: number;
  /** epoch seconds of the latest rate Yahoo reports */
  lastTradeAt: number;
  series: SeriesPoint[];
}

export interface QuotesResponse {
  generatedAt: number;
  quotes: QuoteDto[];
  premium: PremiumDto | null;
  /** Rand per US dollar; null or absent when the rate couldn't be fetched */
  usdZar?: FxDto | null;
  /** symbol -> reason, for anything that failed */
  errors: Record<string, string>;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function isSeries(v: unknown): v is SeriesPoint[] {
  return Array.isArray(v) && v.every((p) => isObj(p) && isNum(p.t) && isNum(p.c));
}

function isQuote(v: unknown): v is QuoteDto {
  return (
    isObj(v) &&
    typeof v.symbol === "string" &&
    typeof v.label === "string" &&
    (v.company === "ASML" || v.company === "SMIC" || v.company === "WATCH" || v.company === "ETF") &&
    (v.exchange === "NASDAQ" || v.exchange === "NYSE" || v.exchange === "AMS" || v.exchange === "SSE" || v.exchange === "HKEX" || v.exchange === "ASX" || v.exchange === "JSE") &&
    typeof v.currency === "string" &&
    isNum(v.price) &&
    isNum(v.prevClose) &&
    isNum(v.changePct) &&
    isNum(v.lastTradeAt) &&
    isSeries(v.series)
  );
}

/** Runtime check for untrusted JSON coming over the network. */
export function isQuotesResponse(v: unknown): v is QuotesResponse {
  if (!isObj(v)) return false;
  if (!isNum(v.generatedAt) || !Array.isArray(v.quotes) || !v.quotes.every(isQuote)) return false;
  if (!isObj(v.errors)) return false;
  if (v.usdZar !== undefined && v.usdZar !== null) {
    const f = v.usdZar;
    if (!isObj(f) || !isNum(f.price) || !isNum(f.prevClose) || !isNum(f.changePct) || !isNum(f.lastTradeAt) || !isSeries(f.series)) {
      return false;
    }
  }
  if (v.premium !== null) {
    if (!isObj(v.premium) || !isNum(v.premium.current) || !isNum(v.premium.asOf) || !isSeries(v.premium.series)) {
      return false;
    }
  }
  return true;
}
