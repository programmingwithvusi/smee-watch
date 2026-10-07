import type { SeriesPoint } from "./types";

export interface ParsedChart {
  price: number;
  prevClose: number;
  changePct: number;
  currency: string;
  lastTradeAt: number;
  series: SeriesPoint[];
}

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketTime?: number; currency?: string };
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }> | null;
    error?: { description?: string } | null;
  };
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * Pure parser for Yahoo's v8 chart response (range=1mo, interval=1d).
 * "Change" is measured against the previous daily close.
 */
export function parseChart(json: unknown): ParsedChart {
  const data = json as YahooChart;
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(data?.chart?.error?.description ?? "no chart result");

  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const series: SeriesPoint[] = [];
  ts.forEach((t, i) => {
    const c = closes[i];
    if (finite(t) && finite(c)) series.push({ t, c });
  });

  const price = result.meta?.regularMarketPrice ?? series.at(-1)?.c;
  const prevClose = series.length >= 2 ? series.at(-2)?.c : undefined;
  const lastTradeAt = result.meta?.regularMarketTime;
  if (!finite(price) || !finite(prevClose) || prevClose === 0 || !finite(lastTradeAt) || series.length < 2) {
    throw new Error("incomplete quote data");
  }
  // The JSE quotes in cents ("ZAc"): report rand, so R296.46 doesn't read as 29646
  const cents = result.meta?.currency === "ZAc";
  const unit = cents ? 0.01 : 1;
  return {
    price: price * unit,
    prevClose: prevClose * unit,
    changePct: ((price - prevClose) / prevClose) * 100,
    currency: cents ? "ZAR" : (result.meta?.currency ?? ""),
    lastTradeAt,
    series: cents ? series.map((p) => ({ t: p.t, c: p.c * unit })) : series,
  };
}

export function chartUrl(symbol: string): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
}
