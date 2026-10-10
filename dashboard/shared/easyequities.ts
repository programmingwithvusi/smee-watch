/**
 * What EasyEquities charges to turn rand into a US share: the EasyFX figures from its support
 * articles (which matched a real August 2026 statement: a 0.5% fee plus 15% VAT), and trading costs
 * measured on that statement. Check them against a fresh statement now and then.
 * Pure arithmetic, no network — the dashboard applies these to the live mid-market rate.
 */

/** EasyFX sets its rate this far above the mid WM/Reuters spot rate */
export const EASYFX_RATE_MARGIN = 0.007;
/** EasyFX fee on the amount transferred, before tax */
export const EASYFX_FEE = 0.005;
/** VAT, charged on the EasyFX fee */
export const VAT = 0.15;
/**
 * Cost of a trade as a share of its value: 0.25% brokerage plus the other trading costs (settlement,
 * investor protection levy, VAT). Measured on a real USD statement, August 2026: $0.59 on a $89.99
 * purchase and $0.25 on $38.00, both 0.66%.
 */
export const TRADE_COSTS = 0.0066;

/** Rand you'd actually part with per US dollar landing in your USD account, given the mid-market rate. */
export function easyFxRate(midUsdZar: number): number {
  return midUsdZar * (1 + EASYFX_RATE_MARGIN) * (1 + EASYFX_FEE * (1 + VAT));
}

/** Rand cost of buying one share priced in USD: EasyFX conversion, then the trading costs. */
export function randCostPerShare(priceUsd: number, midUsdZar: number): number {
  return priceUsd * easyFxRate(midUsdZar) * (1 + TRADE_COSTS);
}

/** How much dearer than the mid-market rate EasyFX works out, in percent (about 1.28). */
export const EASYFX_COST_PCT = (easyFxRate(1) - 1) * 100;
