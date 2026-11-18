import { describe, expect, it } from "vitest";
import { isIncomeEntry, summariseIncome } from "../shared/portfolio";

describe("income", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  const e = (date: string, amount: number, currency = "ZAR") => ({ date, symbol: "X", amount, currency });
  it("totals per currency without mixing", () => {
    const s = summariseIncome([e("2026-11-02", 100), e("2026-10-02", 50), e("2026-11-05", 5, "USD"), e("2025-10-31", 999)], now);
    expect(s.thisMonth).toEqual({ ZAR: 100, USD: 5 });
    expect(s.last12Months).toEqual({ ZAR: 150, USD: 5 });
    expect(s.avgPerMonth.ZAR).toBeCloseTo(12.5);
    expect(s.entries[0]?.date).toBe("2026-11-05");
  });
  it("includes the first day of the 12-month window", () => {
    expect(summariseIncome([e("2025-12-01", 10)], now).last12Months.ZAR).toBe(10);
  });
  it("validates entries", () => {
    expect(isIncomeEntry(e("2026-11-02", 1))).toBe(true);
    expect(isIncomeEntry({ ...e("11/02/2026", 1) })).toBe(false);
    expect(isIncomeEntry({ ...e("2026-11-02", NaN) })).toBe(false);
  });
});
