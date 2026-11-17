import { describe, expect, test } from "vitest";
import { backtestSymbol, formatBacktestTable, simulateWindow } from "../src/backtest";

describe("simulateWindow", () => {
  test("does nothing when no rung is reached", () => {
    const r = simulateWindow([100, 105, 110, 108], "core");
    expect(r.rungsHit).toBe(0);
    expect(r.diffPct).toBeCloseTo(0, 10);
  });

  test("a round trip through a rung beats holding (sold the top slice)", () => {
    // +40% crosses the core +30% rung: sell 25% at 140, then price falls back to 100
    const r = simulateWindow([100, 140, 100], "core", 25);
    expect(r.rungsHit).toBe(1);
    expect(r.ruleValue).toBeCloseTo(110, 6); // 0.75 * 100 + 0.25 * 140
    expect(r.holdValue).toBe(100);
    expect(r.diffPct).toBeCloseTo(10, 6);
  });

  test("selling early costs upside when the price keeps rising", () => {
    const r = simulateWindow([100, 140, 200], "core", 25);
    expect(r.ruleValue).toBeCloseTo(185, 6); // 35 + 0.75 * 200
    expect(r.diffPct).toBeCloseTo(-7.5, 6);
  });

  test("a jump past two rungs in one day sells a slice at each, in order", () => {
    const r = simulateWindow([100, 165], "core", 25); // passes +30% and +60% at once
    expect(r.rungsHit).toBe(2);
    expect(r.ruleValue).toBeCloseTo(165, 6); // everything sold at the same price: no difference
  });

  test("speculative track uses its own rungs and never repeats past the list", () => {
    const r = simulateWindow([100, 125, 150, 300], "speculative", 25);
    expect(r.rungsHit).toBe(2); // +20% and +40% only, even at +200%
  });

  test("needs at least two closes", () => {
    expect(() => simulateWindow([100], "core")).toThrow();
  });
});

describe("backtestSymbol", () => {
  test("counts overlapping windows and reports null stats when the rule never fires", () => {
    const flat = Array.from({ length: 300 }, () => 100);
    const s = backtestSymbol("FLAT", flat, "core", { holdDays: 250, stepDays: 20 });
    expect(s.windows).toBe(3); // starts 0, 20, 40
    expect(s.windowsWithRung).toBe(0);
    expect(s.avgDiffPctWhenHit).toBeNull();
  });

  test("summarises windows where a spike-and-fade hits a rung", () => {
    const path = Array.from({ length: 300 }, (_, i) => (i < 100 ? 100 : i < 150 ? 140 : 100));
    const s = backtestSymbol("SPIKE", path, "core", { holdDays: 250, stepDays: 20 });
    expect(s.windowsWithRung).toBeGreaterThan(0);
    expect(s.ruleAheadCount).toBeGreaterThan(0);
    expect(s.bestDiffPct!).toBeGreaterThan(0);
  });
});

describe("formatBacktestTable", () => {
  test("lists each row and carries the caveats", () => {
    const out = formatBacktestTable([backtestSymbol("ABC", Array.from({ length: 300 }, () => 100), "core")]);
    expect(out).toContain("| ABC | core |");
    expect(out).toContain("Not financial advice");
    expect(out).toContain("overlap");
  });
});

import { compareRules, currentRule, formatComparison, rungsForRule, simulateRule } from "../src/backtest";

describe("rule variants", () => {
  test("rungsForRule: every-N and listed rungs", () => {
    expect(rungsForRule({ kind: "every", stepPct: 50 }, 120)).toEqual([50, 100]);
    expect(rungsForRule({ kind: "every", stepPct: 50 }, 49)).toEqual([]);
    expect(rungsForRule({ kind: "list", rungsPct: [20, 40] }, 25)).toEqual([20]);
  });

  test("simulateRule with no yield matches the plain current rule", () => {
    const path = [100, 140, 100];
    expect(simulateRule(path, currentRule("core")).ruleValue).toBeCloseTo(110, 6);
  });

  test("cash earning a yield ends higher than cash earning nothing", () => {
    const path = Array.from({ length: 251 }, (_, i) => (i < 20 ? 100 : 140));
    const plain = simulateRule(path, currentRule("core"));
    const yielding = simulateRule(path, { ...currentRule("core"), proceedsYieldPct: 6.5 });
    expect(yielding.ruleValue).toBeGreaterThan(plain.ruleValue);
  });

  test("drawdowns: selling into a spike makes the later fall smaller", () => {
    const r = simulateRule([100, 140, 70], currentRule("core"));
    expect(r.holdMaxDdPct).toBeCloseTo(50, 6); // 140 -> 70
    expect(r.ruleMaxDdPct).toBeCloseTo(37.5, 6); // total 140 -> 87.5
  });

  test("compareRules averages over all windows and formats matrices", () => {
    const flat = Array.from({ length: 300 }, () => 100);
    const spike = Array.from({ length: 300 }, (_, i) => (i < 100 ? 100 : i < 150 ? 140 : 100));
    const rows = compareRules({ FLAT: flat, SPIKE: spike });
    const flatRow = rows.find((r) => r.symbol === "FLAT" && r.rule === "Current core")!;
    expect(flatRow.avgDiffPctAll).toBeCloseTo(0, 10);
    expect(flatRow.aheadPct).toBe(0);
    const spikeRow = rows.find((r) => r.symbol === "SPIKE" && r.rule === "Current core")!;
    expect(spikeRow.avgDiffPctAll).toBeGreaterThan(0);
    expect(spikeRow.drawdownCutPp).toBeGreaterThan(0);
    const out = formatComparison(rows);
    expect(out).toContain("Smaller slice (10%)");
    expect(out).toContain("Worst-fall protection");
    expect(out).toContain("Not financial advice");
  });
});
