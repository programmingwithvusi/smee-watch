import { premiumPct, premiumSeries } from "./premium";
import type { PremiumDto, QuoteDto, QuotesResponse } from "./types";
import { FX_SYMBOL, SMIC_A, SMIC_H, USD_ZAR, WATCH_ETFS, WATCH_IDEAS, WATCHLIST } from "./watchlist";
import { parseChart, type ParsedChart } from "./yahoo";

/** Returns the raw Yahoo JSON for a symbol. Injected so the builder is testable offline. */
export type ChartFetcher = (symbol: string) => Promise<unknown>;

const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function buildQuotesResponse(fetchChart: ChartFetcher, now = Date.now()): Promise<QuotesResponse> {
  const items = [...WATCHLIST, ...WATCH_IDEAS, ...WATCH_ETFS];
  const symbols = [...items.map((w) => w.symbol), FX_SYMBOL, USD_ZAR];
  const load = async (s: string) => parseChart(await fetchChart(s));
  // One retry per symbol: Yahoo drops the odd request under a burst, and a missing exchange rate or
  // quote otherwise leaves a hole on the page until the next refresh.
  const settled = await Promise.allSettled(symbols.map((s) => load(s).catch(() => load(s))));

  const parsed = new Map<string, ParsedChart>();
  const errors: Record<string, string> = {};
  settled.forEach((r, i) => {
    const symbol = symbols[i]!;
    if (r.status === "fulfilled") parsed.set(symbol, r.value);
    else errors[symbol] = `${symbol}: ${reason(r.reason)}`;
  });

  const quotes: QuoteDto[] = [];
  for (const w of items) {
    const p = parsed.get(w.symbol);
    if (!p) continue;
    quotes.push({
      symbol: w.symbol,
      label: w.label,
      company: w.company,
      exchange: w.exchange,
      currency: p.currency,
      price: p.price,
      prevClose: p.prevClose,
      changePct: p.changePct,
      lastTradeAt: p.lastTradeAt,
      series: p.series,
    });
  }

  let premium: PremiumDto | null = null;
  const a = parsed.get(SMIC_A);
  const h = parsed.get(SMIC_H);
  const fx = parsed.get(FX_SYMBOL);
  if (a && h && fx) {
    premium = {
      current: premiumPct(a.price, h.price, fx.price),
      asOf: Math.min(a.lastTradeAt, h.lastTradeAt),
      series: premiumSeries(a.series, h.series, fx.series),
    };
  }

  const zar = parsed.get(USD_ZAR);
  const usdZar = zar
    ? { price: zar.price, prevClose: zar.prevClose, changePct: zar.changePct, lastTradeAt: zar.lastTradeAt, series: zar.series }
    : null;

  return { generatedAt: Math.floor(now / 1000), quotes, premium, usdZar, errors };
}
