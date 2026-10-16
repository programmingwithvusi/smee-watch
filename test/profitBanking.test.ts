import { describe, expect, test } from "vitest";
import type { Position } from "../src/config";
import { formatBankAlert, pnlPct, rungsReached } from "../src/profitBanking";

const CORE: Position = { symbol: "ANG.JO", label: "AngloGold Ashanti", track: "core", costPerUnit: 1915.13 };
const SPEC: Position = { symbol: "ASML", label: "ASML", track: "speculative", costPerUnit: 700 };

describe("pnlPct", () => {
  test("computes signed percent gain vs cost", () => {
    expect(pnlPct(1915.13, 1915.13)).toBeCloseTo(0, 5);
    expect(pnlPct(2500, 1915.13)).toBeCloseTo(30.54, 1);
    expect(pnlPct(1500, 1915.13)).toBeCloseTo(-21.68, 1);
  });

  test("rejects a non-positive cost basis", () => {
    expect(() => pnlPct(100, 0)).toThrow();
    expect(() => pnlPct(100, -5)).toThrow();
  });
});

describe("rungsReached — core track (repeats every 30%)", () => {
  test("below the first rung: nothing reached", () => {
    expect(rungsReached(CORE, 10)).toEqual([]);
    expect(rungsReached(CORE, 29.9)).toEqual([]);
  });

  test("exactly at a rung counts as reached", () => {
    expect(rungsReached(CORE, 30)).toEqual([30]);
  });

  test("between rungs: only the ones actually crossed", () => {
    expect(rungsReached(CORE, 45)).toEqual([30]);
  });

  test("a jump straight past several rungs reports all of them", () => {
    expect(rungsReached(CORE, 65)).toEqual([30, 60]);
  });

  test("a loss reaches no rung", () => {
    expect(rungsReached(CORE, -40)).toEqual([]);
  });
});

describe("rungsReached — speculative track (fixed 20% / 40% rungs, no repeat beyond)", () => {
  test("below both rungs", () => {
    expect(rungsReached(SPEC, 10)).toEqual([]);
  });

  test("past the first rung only", () => {
    expect(rungsReached(SPEC, 25)).toEqual([20]);
  });

  test("past both rungs", () => {
    expect(rungsReached(SPEC, 50)).toEqual([20, 40]);
  });

  test("well past the last rung still reports only the two defined", () => {
    expect(rungsReached(SPEC, 1000)).toEqual([20, 40]);
  });
});

describe("formatBankAlert", () => {
  test("names the position, the rung, the gain and the track", () => {
    const msg = formatBankAlert(CORE, 65.2, 60, 3125, "ZAR");
    expect(msg).toContain("AngloGold Ashanti");
    expect(msg).toContain("+65.2%");
    expect(msg).toContain("+60% Core-track rung");
    expect(msg).toContain("3125.00 ZAR");
  });

  test("speculative alerts say Speculative-track", () => {
    const msg = formatBankAlert(SPEC, 22, 20, 854, "USD");
    expect(msg).toContain("Speculative-track rung");
  });

  test("names the income/reinvest split and the income sleeve", () => {
    const msg = formatBankAlert(CORE, 65.2, 60, 3125, "ZAR");
    expect(msg).toContain("Withdraw 50% as cash income");
    expect(msg).toContain("reinvest the other 50%");
    expect(msg).toContain("STXDIV");
  });
});
