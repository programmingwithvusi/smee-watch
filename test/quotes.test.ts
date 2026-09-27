import { describe, expect, test } from "vitest";
import { fmtPct, fmtPrice, parseChart, premiumPct } from "../src/quotes";

const chart = (closes: Array<number | null>, price: number) => ({
  chart: {
    result: [
      {
        meta: { regularMarketPrice: price, regularMarketTime: 1758240000, currency: "HKD" },
        indicators: { quote: [{ close: closes }] },
      },
    ],
    error: null,
  },
});

describe("parseChart", () => {
  test("computes change vs the previous close, ignoring null bars", () => {
    const q = parseChart("0981.HK", chart([50, null, 60, 63], 66));
    expect(q.prevClose).toBe(60);
    expect(q.price).toBe(66);
    expect(q.changePct).toBeCloseTo(10, 5);
    expect(q.day).toBe("2025-09-19");
    expect(q.currency).toBe("HKD");
    expect(q.closeHistory).toEqual([50, 60, 63]); // nulls dropped, in order
  });

  test("throws on missing data instead of returning nonsense", () => {
    expect(() => parseChart("X", { chart: { result: null, error: { description: "Not Found" } } })).toThrow("Not Found");
    expect(() => parseChart("X", chart([100], 101))).toThrow(/incomplete/);
  });
});

describe("premiumPct", () => {
  test("A-share at parity converts to 0%", () => {
    expect(premiumPct(100, 108, 1.08)).toBeCloseTo(0, 6);
  });

  test("A-share richer than H is a positive premium", () => {
    expect(premiumPct(120, 108, 1.08)).toBeCloseTo(20, 6);
  });

  test("rejects a non-positive H price", () => {
    expect(() => premiumPct(100, 0, 1.08)).toThrow();
  });
});

describe("fmtPct", () => {
  test("adds a sign", () => {
    expect(fmtPct(3.456)).toBe("+3.46%");
    expect(fmtPct(-1)).toBe("-1.00%");
  });
});

describe("penny-stock formatting", () => {
  test("prices under 1 keep up to four decimals; float noise isn't a signed zero", () => {
    expect(fmtPrice(0.025)).toBe("0.025");
    expect(fmtPrice(1082.284)).toBe("1082.28");
    expect(fmtPct(-0.0000015)).toBe("0.00%");
  });
});
