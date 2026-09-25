import type { QuotesResponse } from "../shared/types";

/** Builds a Yahoo-shaped chart response: daily closes ending at `price`. */
export function yahooChart(closes: number[], price: number, opts: { currency?: string; lastTrade?: number } = {}) {
  const start = 1_755_000_000; // a fixed Tuesday-ish anchor, epoch seconds
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: price,
            regularMarketTime: opts.lastTrade ?? start + closes.length * 86_400,
            currency: opts.currency ?? "USD",
          },
          timestamp: closes.map((_, i) => start + i * 86_400),
          indicators: { quote: [{ close: closes }] },
        },
      ],
      error: null,
    },
  };
}

const days = (n: number, base: number, step: number) => Array.from({ length: n }, (_, i) => base + i * step);

export const SAMPLE: QuotesResponse = {
  generatedAt: 1_758_300_000,
  errors: {},
  quotes: [
    { symbol: "ASML", label: "ASML on Nasdaq", company: "ASML", exchange: "NASDAQ", currency: "USD", price: 1048.2, prevClose: 1021.5, changePct: 2.61, lastTradeAt: 1_758_290_000, series: days(22, 960, 4).map((c, i) => ({ t: 1_755_000_000 + i * 86_400, c: c + (i % 3) * 6 })) },
    { symbol: "ASML.AS", label: "ASML in Amsterdam", company: "ASML", exchange: "AMS", currency: "EUR", price: 893.4, prevClose: 897.1, changePct: -0.41, lastTradeAt: 1_758_290_000, series: days(22, 850, 2).map((c, i) => ({ t: 1_755_000_000 + i * 86_400, c: c + (i % 4) * 5 })) },
    { symbol: "688981.SS", label: "SMIC A-share, Shanghai", company: "SMIC", exchange: "SSE", currency: "CNY", price: 118.6, prevClose: 112.9, changePct: 5.05, lastTradeAt: 1_758_270_000, series: days(22, 96, 1).map((c, i) => ({ t: 1_755_000_000 + i * 86_400, c: c + (i % 5) * 2 })) },
    { symbol: "0981.HK", label: "SMIC H-share, Hong Kong", company: "SMIC", exchange: "HKEX", currency: "HKD", price: 71.4, prevClose: 69.9, changePct: 2.15, lastTradeAt: 1_758_275_000, series: days(22, 60, 0.5).map((c, i) => ({ t: 1_755_000_000 + i * 86_400, c: c + (i % 4) * 1.2 })) },
  ],
  premium: { current: 63.8, asOf: 1_758_270_000, series: days(22, 48, 0.7).map((c, i) => ({ t: 1_755_000_000 + i * 86_400, c: c + (i % 6) * 2 })) },
};
