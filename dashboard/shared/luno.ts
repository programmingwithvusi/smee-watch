/** Pricing helpers for Luno balances. No network calls here — pure and unit-testable. */
import type { SeriesPoint } from "./types";

export interface LunoTicker {
  pair: string;
  last_trade: string;
}

export interface LunoBalance {
  asset: string;
  /** Available balance, in the asset's own units (e.g. BTC, not cents) */
  balance: number;
  /** Balance held in open orders */
  reserved: number;
  /** Weighted-average ZAR paid per unit still held, from your Luno statement. Absent when unknown
   *  (never computed, or some of the coin arrived by transfer or was bought with another coin). */
  avgCostZar?: number;
}

export interface LunoBalanceSnapshot {
  /** ISO timestamp of when the snapshot script ran, or null if it never has */
  asOf: string | null;
  balances: LunoBalance[];
}

/**
 * Values one asset's balance in ZAR using Luno's public ticker list. ZAR itself values at 1:1.
 * Returns null (not a thrown error) when no `<ASSET>ZAR` pair is found, so callers can show the
 * holding with its balance and no live value rather than dropping it.
 */
export function priceInZar(asset: string, balance: number, tickers: readonly LunoTicker[]): number | null {
  if (asset === "ZAR") return balance;
  const pair = `${asset}ZAR`;
  const ticker = tickers.find((t) => t.pair === pair);
  if (!ticker) return null;
  const price = Number(ticker.last_trade);
  if (!Number.isFinite(price)) return null;
  return balance * price;
}

/**
 * Yahoo Finance symbols for Luno assets, priced in USD — Yahoo has no ZAR crypto pairs. Explicit
 * rather than `${asset}-USD`, because Yahoo reuses short tickers for unrelated coins (JUP-USD is not
 * Jupiter). Assets missing here (e.g. Luno-only tokens) simply show no daily change.
 */
export const YAHOO_USD_SYMBOL: Readonly<Record<string, string>> = {
  XBT: "BTC-USD",
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  XRP: "XRP-USD",
  ADA: "ADA-USD",
  DOT: "DOT-USD",
  LTC: "LTC-USD",
  BCH: "BCH-USD",
  LINK: "LINK-USD",
  AVAX: "AVAX-USD",
  TRX: "TRX-USD",
  USDC: "USDC-USD",
  USDT: "USDT-USD",
  JUP: "JUP29210-USD",
  // Tokenized SpaceX stock (xStock)
  SPCXx: "SPCXX-USD",
};

/** Yahoo's USD→ZAR rate */
export const USD_ZAR_SYMBOL = "ZAR=X";

/** Yahoo stamps FX days at London midnight, crypto days at UTC midnight: allow a few hours either side. */
const FX_SLACK_S = 6 * 3600;

export interface ZarTrend {
  /** Daily closes converted to ZAR, oldest first */
  series: SeriesPoint[];
  /** Change of the latest ZAR value against the previous day's, in percent */
  changePct: number;
}

/**
 * Converts a coin's daily USD closes into ZAR using the USD→ZAR close for the same day, or the
 * latest earlier one (FX doesn't trade at weekends; crypto does). `nowUsd`/`nowFx` replace the last
 * point so the change reflects the current price rather than a partial day's close. Returns null
 * when there aren't two days to compare.
 */
export function zarTrend(coinUsd: readonly SeriesPoint[], usdZar: readonly SeriesPoint[], nowUsd: number, nowFx: number): ZarTrend | null {
  const fx = [...usdZar].sort((a, b) => a.t - b.t);
  const series: SeriesPoint[] = [];
  let rate: number | undefined;
  let j = 0;
  for (const p of [...coinUsd].sort((a, b) => a.t - b.t)) {
    for (let next = fx[j]; next && next.t <= p.t + FX_SLACK_S; next = fx[++j]) rate = next.c;
    if (rate !== undefined) series.push({ t: p.t, c: p.c * rate });
  }
  const last = series.at(-1);
  const prev = series.at(-2);
  if (!last || !prev || prev.c === 0) return null;
  last.c = nowUsd * nowFx;
  return { series, changePct: ((last.c - prev.c) / prev.c) * 100 };
}

/** One Luno statement entry (GET /api/1/accounts/{id}/transactions), amounts already parsed. */
export interface LunoStatementEntry {
  currency: string;
  /** Change to the account's balance: positive in, negative out */
  delta: number;
  kind: "EXCHANGE" | "FEE" | "TRANSFER" | "INTEREST" | string;
  /** Shared by every entry of one transaction: both legs of a buy, and its fee */
  reference: string;
  timestamp: number;
  rowIndex: number;
}

/**
 * Weighted-average ZAR cost per unit of each coin, replayed from statement entries across all your
 * accounts. Entries are grouped by `reference`, so an instant buy's coin leg, ZAR leg and fees count
 * as one purchase. Buying with ZAR adds cost; selling, sending and coin fees reduce the quantity at
 * the existing average; interest arrives at zero cost. A coin that ever arrived by transfer or by a
 * coin-for-coin swap has an unknown cost and is left out — a wrong number is worse than none.
 */
export function lunoCostBasis(entries: readonly LunoStatementEntry[]): Map<string, number> {
  const refs = new Map<string, { at: number; row: number; kinds: Set<string>; net: Map<string, number> }>();
  for (const e of entries) {
    const key = e.reference || `row:${e.currency}:${e.rowIndex}`;
    const r = refs.get(key) ?? { at: e.timestamp, row: e.rowIndex, kinds: new Set<string>(), net: new Map<string, number>() };
    r.at = Math.min(r.at, e.timestamp);
    r.kinds.add(e.kind);
    r.net.set(e.currency, (r.net.get(e.currency) ?? 0) + e.delta);
    refs.set(key, r);
  }

  const pos = new Map<string, { qty: number; cost: number; unknown: boolean }>();
  const get = (c: string) => pos.get(c) ?? pos.set(c, { qty: 0, cost: 0, unknown: false }).get(c)!;
  const reduce = (c: string, amount: number) => {
    const p = get(c);
    const left = Math.max(0, p.qty - amount);
    p.cost = p.qty > 0 ? (p.cost * left) / p.qty : 0;
    p.qty = left;
  };

  for (const r of [...refs.values()].sort((a, b) => a.at - b.at || a.row - b.row)) {
    const zar = r.net.get("ZAR") ?? 0;
    const coins = [...r.net].filter(([c, d]) => c !== "ZAR" && Math.abs(d) > 1e-12);
    const exchange = r.kinds.has("EXCHANGE");
    for (const [c, d] of coins) {
      const p = get(c);
      if (d < 0) {
        reduce(c, -d);
      } else if (exchange && zar < 0 && coins.length === 1) {
        p.qty += d;
        p.cost += -zar;
      } else if (r.kinds.has("INTEREST") && !exchange) {
        p.qty += d;
      } else {
        // Received by transfer, or swapped from another coin: no ZAR price to attach
        p.qty += d;
        p.unknown = true;
      }
    }
  }

  const out = new Map<string, number>();
  for (const [c, p] of pos) if (!p.unknown && p.qty > 1e-12 && p.cost > 0) out.set(c, p.cost / p.qty);
  return out;
}
