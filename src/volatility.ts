import { VOLATILITY_LOOKBACK_DAYS, VOLATILITY_MIN_AVG_PCT, VOLATILITY_MIN_MOVE_PCT, VOLATILITY_MULTIPLIER } from "./config";

export interface VolatilityOptions {
  multiplier?: number;
  minAvgPct?: number;
  minMovePct?: number;
  lookback?: number;
}

export interface VolatilityCheck {
  unusual: boolean;
  /** The symbol's average daily |move| over the trailing window, percent. */
  avgAbsMovePct: number;
}

/**
 * Flags a day's move as unusual relative to the symbol's OWN recent behaviour, rather than a
 * fixed threshold — a 1.5% day can be unremarkable for one stock and unusual for a quieter one.
 *
 * `closes`: consecutive daily closes, oldest first, ending at the bar `changePct` was computed
 * from (so the last pairwise change in `closes` reproduces `changePct`). That final change is
 * excluded from the baseline average — it's what's being judged, not part of "normal".
 */
export function checkVolatility(closes: readonly number[], changePct: number, opts: VolatilityOptions = {}): VolatilityCheck {
  const multiplier = opts.multiplier ?? VOLATILITY_MULTIPLIER;
  const minAvgPct = opts.minAvgPct ?? VOLATILITY_MIN_AVG_PCT;
  const minMovePct = opts.minMovePct ?? VOLATILITY_MIN_MOVE_PCT;
  const lookback = opts.lookback ?? VOLATILITY_LOOKBACK_DAYS;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1]!;
    const cur = closes[i]!;
    if (prev > 0) changes.push(Math.abs((cur - prev) / prev) * 100);
  }

  const baseline = changes.slice(0, -1).slice(-lookback);
  if (baseline.length === 0) return { unusual: false, avgAbsMovePct: 0 };

  const avgAbsMovePct = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  const unusual = Math.abs(changePct) >= minMovePct && avgAbsMovePct >= minAvgPct && Math.abs(changePct) >= avgAbsMovePct * multiplier;
  return { unusual, avgAbsMovePct };
}
