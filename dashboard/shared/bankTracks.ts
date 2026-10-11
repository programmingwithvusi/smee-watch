/**
 * Mirrors the `track` field of POSITIONS in the backend's src/config.ts, so the dashboard can show
 * the same core/speculative bank-rung cue the Telegram alerts (src/profitBanking.ts) act on. Keep
 * these two files in step: add a symbol here whenever you add one there, and vice versa.
 *
 * This is a lighter-touch visual nudge, not a notification: unlike profitBankingCheck.ts, it does
 * not track which rung was already alerted -- it just reflects where the current gain sits right
 * now, recomputed fresh on every load.
 */
export type BankTrack = "core" | "speculative";

export const BANK_TRACK: Record<string, BankTrack> = {
  "ANG.JO": "core",
  "STXMMT.JO": "core",
  MRNA: "core",
  SPCX: "core",
  // Track B (ASML/SMIC) has no position yet -- add it here once held, matching src/config.ts.
};

/** Core track: bank a slice at every multiple of this (30, 60, 90, ...). */
export const CORE_BANK_RUNG_PCT = 30;
/** Speculative track: the first of its two fixed rungs (20, then 40) -- the only one this badge watches for. */
export const SPECULATIVE_FIRST_RUNG_PCT = 20;

/** How close to the next rung counts as "approaching" it, in percentage points. */
const APPROACH_WINDOW_PCT = 5;

export type BankBadge = "reached" | "approaching" | null;

/** A symbol not in BANK_TRACK (not actually held, or Track B before a first buy) gets no badge. */
export function bankBadge(symbol: string, pnlPct: number): BankBadge {
  const track = BANK_TRACK[symbol];
  if (!track) return null;
  const firstRung = track === "core" ? CORE_BANK_RUNG_PCT : SPECULATIVE_FIRST_RUNG_PCT;
  if (pnlPct >= firstRung) return "reached";
  if (pnlPct >= firstRung - APPROACH_WINDOW_PCT) return "approaching";
  return null;
}
