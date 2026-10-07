import { errMsg } from "./log";

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number;
  currency: string;
  /** UTC date (YYYY-MM-DD) of the latest price; used to de-duplicate alerts per trading day */
  day: string;
  /** Consecutive daily closes, oldest first, ending at the bar `price`/`prevClose` came from. Used to gauge whether today's move is unusual for this symbol. */
  closeHistory: number[];
}

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }> | null;
    error?: { description?: string } | null;
  };
}

const UA = "Mozilla/5.0 (compatible; smee-watch/1.0)";

/** Pure parser (unit-tested). Uses the last two daily closes so "change" means change vs previous close. */
export function parseChart(symbol: string, json: unknown): Quote {
  const data = json as YahooChart;
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(data.chart?.error?.description ?? "no chart result");

  const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (c): c is number => typeof c === "number" && Number.isFinite(c),
  );
  const price = result.meta?.regularMarketPrice ?? closes.at(-1);
  const prevClose = closes.length >= 2 ? closes.at(-2) : undefined;
  const ts = result.meta?.regularMarketTime;
  if (price === undefined || prevClose === undefined || prevClose === 0 || ts === undefined) {
    throw new Error("incomplete quote data");
  }
  // The JSE quotes in cents ("ZAc"): report rand, so R296.46 doesn't read as 29646
  const cents = result.meta?.currency === "ZAc";
  const unit = cents ? 0.01 : 1;
  return {
    symbol,
    price: price * unit,
    prevClose: prevClose * unit,
    changePct: ((price - prevClose) / prevClose) * 100,
    currency: cents ? "ZAR" : (result.meta?.currency ?? ""),
    day: new Date(ts * 1000).toISOString().slice(0, 10),
    closeHistory: closes.map((c) => c * unit),
  };
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  // range=1mo gives enough trailing bars for the volatility-widening check (needs ~5 prior days beyond prevClose)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseChart(symbol, await res.json());
  } catch (e) {
    throw new Error(`${symbol}: ${errMsg(e)}`);
  }
}

/** A-share premium over the H-share, in percent. Positive = A-share trades richer. */
export function premiumPct(aPriceCny: number, hPriceHkd: number, hkdPerCny: number): number {
  if (hPriceHkd <= 0) throw new Error("H-share price must be positive");
  return ((aPriceCny * hkdPerCny) / hPriceHkd - 1) * 100;
}

/** Rounds before signing, so float noise like -0.000001 reads "0.00%", not "-0.00%". */
export const fmtPct = (n: number): string => {
  const r = Number(n.toFixed(2)) || 0;
  return `${r > 0 ? "+" : ""}${r.toFixed(2)}%`;
};

/** Two decimals, or up to four for prices under 1 so a A$0.025 penny stock doesn't read as 0.03. */
export const fmtPrice = (n: number): string =>
  Math.abs(n) < 1 && n !== 0 ? String(Number(n.toFixed(4))) : n.toFixed(2);
