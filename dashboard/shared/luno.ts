/** Pricing helpers for Luno balances. No network calls here — pure and unit-testable. */

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
