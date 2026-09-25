import { describe, expect, test } from "vitest";
import { checkVolatility } from "../src/volatility";

describe("checkVolatility", () => {
  test("flags a move well above the symbol's own recent average", () => {
    // Quiet history (~0.5% daily moves), then today's move is 6% — well over 1.8x the ~0.5% baseline
    const closes = [100, 100.5, 99.9, 100.4, 99.8, 100.3, 106.3];
    const changePct = ((106.3 - 100.3) / 100.3) * 100;
    const r = checkVolatility(closes, changePct);
    expect(r.unusual).toBe(true);
    expect(r.avgAbsMovePct).toBeGreaterThan(0);
    expect(r.avgAbsMovePct).toBeLessThan(1);
  });

  test("does not flag an ordinary move for a symbol that's normally this volatile", () => {
    // A symbol whose recent daily moves already run ~3%; today's 4% move isn't "unusual" for it
    const closes = [100, 103, 99.8, 103.2, 100.1, 103.3, 107.5];
    const changePct = ((107.5 - 103.3) / 103.3) * 100;
    const r = checkVolatility(closes, changePct);
    expect(r.unusual).toBe(false);
  });

  test("ignores a near-flat baseline so tiny moves don't count as multiples of near-zero", () => {
    const closes = [100, 100.01, 99.99, 100.02, 99.98, 100.01, 100.3];
    const changePct = ((100.3 - 100.01) / 100.01) * 100;
    const r = checkVolatility(closes, changePct, { minAvgPct: 0.3 });
    expect(r.unusual).toBe(false); // baseline avg is below minAvgPct, so it's skipped regardless of multiple
  });

  test("ignores a tiny absolute move even against a dead-quiet baseline", () => {
    const closes = [100, 100, 100, 100, 100, 100, 100.2];
    const changePct = 0.2;
    const r = checkVolatility(closes, changePct, { minAvgPct: 0, minMovePct: 1 });
    expect(r.unusual).toBe(false);
  });

  test("needs at least one prior pairwise change to form a baseline", () => {
    expect(checkVolatility([100], 0).unusual).toBe(false);
    expect(checkVolatility([100, 105], 5).unusual).toBe(false); // only the "today" change exists, no baseline
  });

  test("only uses the trailing lookback window, not the whole history", () => {
    // Old volatile history far in the past, quiet lately, then a moderate move today
    const closes = [100, 110, 90, 108, 92, 100, 100.2, 99.9, 100.3, 99.8, 101.5];
    const changePct = ((101.5 - 99.8) / 99.8) * 100;
    const r = checkVolatility(closes, changePct, { lookback: 3 });
    expect(r.avgAbsMovePct).toBeLessThan(1); // dominated by the recent quiet window, not the old volatile one
  });
});
