/**
 * What EasyEquities charges to turn rand into a US share, from its support articles (EasyFX; Fees
 * and costs). They carry no dates, so check them against the current cost profile now and then.
 * Pure arithmetic, no network — the dashboard applies these to the live mid-market rate.
 */

/** EasyFX sets its rate this far above the mid WM/Reuters spot rate */
export const EASYFX_RATE_MARGIN = 0.007;
/** EasyFX fee on the amount transferred, before tax */
export const EASYFX_FEE = 0.005;
/** VAT, charged on the EasyFX fee */
export const VAT = 0.15;
/** Brokerage per trade */
export const BROKERAGE = 0.0025;

/** Rand you'd actually part with per US dollar landing in your USD account, given the mid-market rate. */
export function easyFxRate(midUsdZar: number): number {
  return midUsdZar * (1 + EASYFX_RATE_MARGIN) * (1 + EASYFX_FEE * (1 + VAT));
}

/** Rand cost of buying one share priced in USD: EasyFX conversion, then brokerage on the trade. */
export function randCostPerShare(priceUsd: number, midUsdZar: number): number {
  return priceUsd * easyFxRate(midUsdZar) * (1 + BROKERAGE);
}

/** How much dearer than the mid-market rate EasyFX works out, in percent (about 1.28). */
export const EASYFX_COST_PCT = (easyFxRate(1) - 1) * 100;
