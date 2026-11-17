import { BANK_SLICE_PCT } from "./config";
import { pnlPct, rungsReached } from "./profitBanking";

export type Track = "core" | "speculative";

export interface WindowResult {
  /** Value at the end of the window with the banking rule: what is still held plus the proceeds taken out */
  ruleValue: number;
  /** Value of simply holding the whole position */
  holdValue: number;
  rungsHit: number;
  /** Rule value vs holding, in percent (0 when no rung was ever reached) */
  diffPct: number;
}

/**
 * Replays the profit-banking rule over one price path. One hypothetical unit is bought at the first
 * close; whenever the gain crosses a new rung, `slicePct` of what is still held is sold at that
 * day's close. Proceeds are counted at face value (no interest, no reinvestment growth), and fees,
 * tax, dividends and exchange-rate moves are ignored: this isolates what the rungs do to the path.
 */
export function simulateWindow(closes: readonly number[], track: Track, slicePct = BANK_SLICE_PCT): WindowResult {
  if (closes.length < 2) throw new Error("need at least two closes");
  const cost = closes[0]!;
  let units = 1;
  let proceeds = 0;
  const hit = new Set<number>();
  for (const close of closes.slice(1)) {
    for (const rung of rungsReached({ track }, pnlPct(close, cost))) {
      if (hit.has(rung)) continue;
      hit.add(rung);
      const sold = (units * slicePct) / 100;
      proceeds += sold * close;
      units -= sold;
    }
  }
  const last = closes[closes.length - 1]!;
  const ruleValue = units * last + proceeds;
  return { ruleValue, holdValue: last, rungsHit: hit.size, diffPct: (ruleValue / last - 1) * 100 };
}

export interface BacktestSummary {
  symbol: string;
  track: Track;
  windows: number;
  /** Windows in which at least one rung was reached (the rule did something) */
  windowsWithRung: number;
  /** Of those, how many ended with the rule ahead of just holding */
  ruleAheadCount: number;
  avgDiffPctWhenHit: number | null;
  medianDiffPctWhenHit: number | null;
  worstDiffPct: number | null;
  bestDiffPct: number | null;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * Starts a hypothetical position every `stepDays` trading days and holds it for `holdDays`, so the
 * answer doesn't hinge on one lucky or unlucky entry date. Windows overlap, so they are not
 * independent samples: read the numbers as a rough picture, not a statistical proof.
 */
export function backtestSymbol(
  symbol: string,
  closes: readonly number[],
  track: Track,
  opts: { holdDays?: number; stepDays?: number; slicePct?: number } = {},
): BacktestSummary {
  const { holdDays = 250, stepDays = 20, slicePct = BANK_SLICE_PCT } = opts;
  const results: WindowResult[] = [];
  for (let start = 0; start + holdDays < closes.length; start += stepDays) {
    results.push(simulateWindow(closes.slice(start, start + holdDays + 1), track, slicePct));
  }
  const hits = results.filter((r) => r.rungsHit > 0);
  const diffs = hits.map((r) => r.diffPct);
  return {
    symbol,
    track,
    windows: results.length,
    windowsWithRung: hits.length,
    ruleAheadCount: hits.filter((r) => r.ruleValue > r.holdValue).length,
    avgDiffPctWhenHit: diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null,
    medianDiffPctWhenHit: diffs.length ? median(diffs) : null,
    worstDiffPct: diffs.length ? Math.min(...diffs) : null,
    bestDiffPct: diffs.length ? Math.max(...diffs) : null,
  };
}

const f = (n: number | null): string => (n === null ? "-" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

export function formatBacktestTable(rows: readonly BacktestSummary[], slicePct = BANK_SLICE_PCT): string {
  const lines = [
    `Banking rule vs buy-and-hold, 1-year holds, starting a new one every 20 trading days. Slice per rung: ${slicePct}% of what is held.`,
    "",
    "| Symbol | Track | Windows | Rule reached a rung | Ahead of holding | Avg diff | Median | Worst | Best |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) {
    const ahead = r.windowsWithRung ? `${r.ruleAheadCount}/${r.windowsWithRung}` : "-";
    lines.push(
      `| ${r.symbol} | ${r.track} | ${r.windows} | ${r.windowsWithRung} | ${ahead} | ${f(r.avgDiffPctWhenHit)} | ${f(r.medianDiffPctWhenHit)} | ${f(r.worstDiffPct)} | ${f(r.bestDiffPct)} |`,
    );
  }
  lines.push(
    "",
    "Diff columns only count windows where a rung was reached (otherwise the rule does nothing and equals holding).",
    "Simplifications: proceeds are counted at face value (no interest or reinvestment growth); fees, tax, dividends and FX are ignored; windows overlap, so this is a rough picture, not proof. Past prices do not predict future ones. Not financial advice.",
  );
  return lines.join("\n");
}
