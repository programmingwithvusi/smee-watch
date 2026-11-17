import { BANK_SLICE_PCT, CORE_BANK_RUNG_PCT, SPECULATIVE_BANK_RUNGS_PCT } from "./config";
import { pnlPct, rungsReached } from "./profitBanking";

export type Track = "core" | "speculative";

/** Where a rule banks: at every multiple of `stepPct` (30, 60, 90...), or at each listed gain once. */
export type RungSpec = { kind: "every"; stepPct: number } | { kind: "list"; rungsPct: readonly number[] };

export interface BankRule {
  name: string;
  /** Share of what is still held that is sold at each rung */
  slicePct: number;
  rungs: RungSpec;
  /** Yearly yield credited to the cash taken out (e.g. reinvested in an income fund). Default 0. */
  proceedsYieldPct?: number;
}

/** Every rung of the spec that a gain of `pnl` percent has reached, lowest first. */
export function rungsForRule(spec: RungSpec, pnl: number): number[] {
  if (spec.kind === "list") return spec.rungsPct.filter((r) => pnl >= r);
  const tiers = Math.floor(pnl / spec.stepPct);
  return tiers < 1 ? [] : Array.from({ length: tiers }, (_, i) => (i + 1) * spec.stepPct);
}

/** The rule you actually run today, for one track. */
export const currentRule = (track: Track, slicePct = BANK_SLICE_PCT): BankRule =>
  track === "core"
    ? { name: "Current core", slicePct, rungs: { kind: "every", stepPct: CORE_BANK_RUNG_PCT } }
    : { name: "Current speculative", slicePct, rungs: { kind: "list", rungsPct: SPECULATIVE_BANK_RUNGS_PCT } };

export interface WindowResult {
  /** Value at the end of the window with the banking rule: what is still held plus the proceeds taken out */
  ruleValue: number;
  /** Value of simply holding the whole position */
  holdValue: number;
  rungsHit: number;
  /** Rule value vs holding, in percent (0 when no rung was ever reached) */
  diffPct: number;
  /** Largest peak-to-trough fall of the rule's total value during the window, in percent */
  ruleMaxDdPct: number;
  /** Same for just holding */
  holdMaxDdPct: number;
}

const TRADING_DAYS = 252;

function maxDrawdownPct(values: readonly number[]): number {
  let peak = values[0]!;
  let worst = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    worst = Math.max(worst, (peak - v) / peak);
  }
  return worst * 100;
}

/**
 * Replays a banking rule over one price path. One hypothetical unit is bought at the first close;
 * whenever the gain crosses a new rung, `slicePct` of what is still held is sold at that day's
 * close. Cash taken out earns the rule's `proceedsYieldPct` (default none). Fees, tax, dividends
 * and exchange-rate moves are ignored: this isolates what the rungs do to the price path.
 */
export function simulateRule(closes: readonly number[], rule: BankRule): WindowResult {
  if (closes.length < 2) throw new Error("need at least two closes");
  const cost = closes[0]!;
  const daily = (1 + (rule.proceedsYieldPct ?? 0) / 100) ** (1 / TRADING_DAYS);
  let units = 1;
  let cash = 0;
  const hit = new Set<number>();
  const path: number[] = [cost];
  for (const close of closes.slice(1)) {
    cash *= daily;
    for (const rung of rungsForRule(rule.rungs, pnlPct(close, cost))) {
      if (hit.has(rung)) continue;
      hit.add(rung);
      const sold = (units * rule.slicePct) / 100;
      cash += sold * close;
      units -= sold;
    }
    path.push(units * close + cash);
  }
  const last = closes[closes.length - 1]!;
  const ruleValue = path[path.length - 1]!;
  return {
    ruleValue,
    holdValue: last,
    rungsHit: hit.size,
    diffPct: (ruleValue / last - 1) * 100,
    ruleMaxDdPct: maxDrawdownPct(path),
    holdMaxDdPct: maxDrawdownPct(closes),
  };
}

/** The current rule for a track, with no yield on proceeds. Kept for the existing summary table. */
export function simulateWindow(closes: readonly number[], track: Track, slicePct = BANK_SLICE_PCT): WindowResult {
  return simulateRule(closes, currentRule(track, slicePct));
}

/** Overlapping windows: a new hypothetical position every `stepDays`, each held `holdDays`. */
function windowsOf(closes: readonly number[], holdDays: number, stepDays: number): number[][] {
  const out: number[][] = [];
  for (let start = 0; start + holdDays < closes.length; start += stepDays) out.push(closes.slice(start, start + holdDays + 1));
  return out;
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

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
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
  const results = windowsOf(closes, holdDays, stepDays).map((w) => simulateWindow(w, track, slicePct));
  const hits = results.filter((r) => r.rungsHit > 0);
  const diffs = hits.map((r) => r.diffPct);
  return {
    symbol,
    track,
    windows: results.length,
    windowsWithRung: hits.length,
    ruleAheadCount: hits.filter((r) => r.ruleValue > r.holdValue).length,
    avgDiffPctWhenHit: diffs.length ? mean(diffs) : null,
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

// ---------------------------------------------------------------------------------------------
// Comparing rule variants

/** Alternatives worth testing against what you run today. Research only: changing the real rule is a separate step. */
export const RULE_VARIANTS: readonly BankRule[] = [
  currentRule("core"),
  currentRule("speculative"),
  { name: "Smaller slice (10%)", slicePct: 10, rungs: { kind: "every", stepPct: CORE_BANK_RUNG_PCT } },
  { name: "Wider rungs (every +50%)", slicePct: BANK_SLICE_PCT, rungs: { kind: "every", stepPct: 50 } },
  { name: "Only big wins (every +100%)", slicePct: BANK_SLICE_PCT, rungs: { kind: "every", stepPct: 100 } },
  { name: "Take cost out at +100%", slicePct: 50, rungs: { kind: "list", rungsPct: [100] } },
  { name: "Current core, cash earns 6.5%/yr", slicePct: BANK_SLICE_PCT, rungs: { kind: "every", stepPct: CORE_BANK_RUNG_PCT }, proceedsYieldPct: 6.5 },
];

export interface RuleComparison {
  rule: string;
  symbol: string;
  windows: number;
  /** Mean (rule - hold) over ALL windows, counting 0 where the rule never fired: comparable across rules */
  avgDiffPctAll: number;
  /** Share of windows where the rule finished strictly ahead of holding */
  aheadPct: number;
  /** Mean reduction in the worst peak-to-trough fall, in percentage points (positive = the rule fell less) */
  drawdownCutPp: number;
  /** Worst single window vs holding */
  worstDiffPct: number;
}

export function compareRules(
  closesBySymbol: Readonly<Record<string, readonly number[]>>,
  rules: readonly BankRule[] = RULE_VARIANTS,
  opts: { holdDays?: number; stepDays?: number } = {},
): RuleComparison[] {
  const { holdDays = 250, stepDays = 20 } = opts;
  const out: RuleComparison[] = [];
  for (const [symbol, closes] of Object.entries(closesBySymbol)) {
    const windows = windowsOf(closes, holdDays, stepDays);
    if (windows.length === 0) continue;
    for (const rule of rules) {
      const rs = windows.map((w) => simulateRule(w, rule));
      out.push({
        rule: rule.name,
        symbol,
        windows: rs.length,
        avgDiffPctAll: mean(rs.map((r) => r.diffPct)),
        aheadPct: (rs.filter((r) => r.ruleValue > r.holdValue + 1e-9).length / rs.length) * 100,
        drawdownCutPp: mean(rs.map((r) => r.holdMaxDdPct - r.ruleMaxDdPct)),
        worstDiffPct: Math.min(...rs.map((r) => r.diffPct)),
      });
    }
  }
  return out;
}

const pp = (n: number): string => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;

/** Two matrices (rules x symbols): return vs holding, and how much less the rule fell at its worst. */
export function formatComparison(rows: readonly RuleComparison[]): string {
  if (rows.length === 0) return "No comparison rows (not enough price history).";
  const symbols = [...new Set(rows.map((r) => r.symbol))];
  const rules = [...new Set(rows.map((r) => r.rule))];
  const cell = (rule: string, symbol: string, pick: (r: RuleComparison) => number, fmt: (n: number) => string): string => {
    const r = rows.find((x) => x.rule === rule && x.symbol === symbol);
    return r ? fmt(pick(r)) : "-";
  };
  const allCol = (rule: string, pick: (r: RuleComparison) => number, fmt: (n: number) => string): string =>
    fmt(mean(rows.filter((r) => r.rule === rule).map(pick)));
  const head = `| Rule | ${symbols.join(" | ")} | All (average) |`;
  const sep = `|---|${[...symbols, "all"].map(() => "---").join("|")}|`;
  const matrix = (pick: (r: RuleComparison) => number, fmt: (n: number) => string): string[] => [
    head,
    sep,
    ...rules.map((rule) => `| ${rule} | ${symbols.map((s) => cell(rule, s, pick, fmt)).join(" | ")} | **${allCol(rule, pick, fmt)}** |`),
  ];
  return [
    "### Return vs holding (average over every window, 0 where the rule never fired)",
    "",
    ...matrix((r) => r.avgDiffPctAll, f),
    "",
    "### Worst-fall protection (percentage points: positive = the rule's worst drop was smaller than holding's)",
    "",
    ...matrix((r) => r.drawdownCutPp, pp),
    "",
    "### Share of windows where the rule finished ahead of holding",
    "",
    ...matrix((r) => r.aheadPct, (n) => `${n.toFixed(0)}%`),
    "",
    "Same 1-year windows as above. Fees, tax, dividends and FX are ignored; windows overlap; five years that were kind to growth shares and gold are one scenario, not a forecast. Not financial advice.",
  ].join("\n");
}
