import type { Position } from "./config";
import { BANK_INCOME_SLEEVE, BANK_SPLIT_INCOME_PCT, CORE_BANK_RUNG_PCT, SPECULATIVE_BANK_RUNGS_PCT } from "./config";

/** Unrealised profit/loss, in percent, vs. a position's average cost. */
export function pnlPct(price: number, costPerUnit: number): number {
  if (costPerUnit <= 0) throw new Error("cost per unit must be positive");
  return ((price - costPerUnit) / costPerUnit) * 100;
}

/**
 * Every rung (percent gain) this position has now reached, lowest first. Pure and testable;
 * profitBankingCheck.ts dedups per symbol+rung via state so a rung notifies at most once, even
 * if the price keeps climbing past it on later runs.
 *
 * core: every multiple of CORE_BANK_RUNG_PCT up to the current gain (so a jump straight from +10%
 * to +65% between runs still reports both the +30% and +60% rungs it passed through).
 * speculative: whichever of SPECULATIVE_BANK_RUNGS_PCT have been reached; no repeats beyond the list.
 */
export function rungsReached(position: Pick<Position, "track">, pnl: number): number[] {
  if (position.track === "core") {
    const topTier = Math.floor(pnl / CORE_BANK_RUNG_PCT);
    if (topTier < 1) return [];
    return Array.from({ length: topTier }, (_, i) => (i + 1) * CORE_BANK_RUNG_PCT);
  }
  return SPECULATIVE_BANK_RUNGS_PCT.filter((rung) => pnl >= rung);
}

export function formatBankAlert(position: Position, pnl: number, rung: number, price: number, currency: string): string {
  const track = position.track === "core" ? "Core" : "Speculative";
  const sign = pnl > 0 ? "+" : "";
  const reinvestPct = 100 - BANK_SPLIT_INCOME_PCT;
  return [
    `💰 Bank some profit? ${position.label} is ${sign}${pnl.toFixed(1)}% from cost -- crossed the +${rung}% ${track}-track rung.`,
    `Now ${price.toFixed(2)} ${currency} (cost basis ${position.costPerUnit.toFixed(2)} ${currency}/unit).`,
    `Per the plan: sell a slice on its own platform. Withdraw ${BANK_SPLIT_INCOME_PCT}% as cash income, reinvest the other ${reinvestPct}% into your income sleeve (${BANK_INCOME_SLEEVE}). Not financial advice, just the rule you set.`,
  ].join("\n");
}
