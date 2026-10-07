import { describe, expect, test } from "vitest";
import { buildQuotesResponse } from "../shared/build";
import { corsHeaders } from "../shared/cors";
import { premiumPct, premiumSeries } from "../shared/premium";
import { isQuotesResponse } from "../shared/types";
import { parseChart } from "../shared/yahoo";
import { WATCH_IDEAS } from "../shared/watchlist";
import { SAMPLE, yahooChart } from "./fixtures";

describe("parseChart", () => {
  test("measures change against the previous daily close and ignores null bars", () => {
    const json = yahooChart([100, 102, 104, 110], 121, { currency: "HKD" });
    (json.chart.result[0]!.indicators.quote[0]!.close as Array<number | null>)[1] = null;
    const p = parseChart(json);
    expect(p.prevClose).toBe(104);
    expect(p.changePct).toBeCloseTo(((121 - 104) / 104) * 100, 6);
    expect(p.currency).toBe("HKD");
    expect(p.series).toHaveLength(3);
  });

  test("throws a useful message when Yahoo reports an error", () => {
    expect(() => parseChart({ chart: { result: null, error: { description: "Not Found" } } })).toThrow("Not Found");
  });

  test("throws on incomplete data instead of returning nonsense", () => {
    expect(() => parseChart(yahooChart([100], 101))).toThrow(/incomplete/);
  });
});

describe("premium maths", () => {
  test("parity converts to zero and richer A-shares are positive", () => {
    expect(premiumPct(100, 108, 1.08)).toBeCloseTo(0, 6);
    expect(premiumPct(120, 108, 1.08)).toBeCloseTo(20, 6);
  });

  test("rejects a non-positive H-share price", () => {
    expect(() => premiumPct(100, 0, 1.08)).toThrow();
  });

  test("premiumSeries joins by day and uses the latest FX rate on or before that day", () => {
    const d = 86_400;
    const t0 = 1_755_000_000;
    const a = [{ t: t0, c: 100 }, { t: t0 + d, c: 110 }, { t: t0 + 2 * d, c: 120 }];
    const h = [{ t: t0, c: 108 }, { t: t0 + 2 * d, c: 108 }]; // H-share closed on day 1
    const fx = [{ t: t0 - d, c: 1.08 }, { t: t0 + d, c: 1.1 }];
    const s = premiumSeries(a, h, fx);
    expect(s).toHaveLength(2);
    expect(s[0]!.c).toBeCloseTo(0, 6); // 100 * 1.08 / 108
    expect(s[1]!.c).toBeCloseTo(((120 * 1.1) / 108 - 1) * 100, 6); // FX from day 1 carried forward
  });
});

describe("buildQuotesResponse", () => {
  const good: Record<string, unknown> = {
    ASML: yahooChart([1000, 1010, 1020], 1050),
    "ASML.AS": yahooChart([880, 885, 890], 893, { currency: "EUR" }),
    "688981.SS": yahooChart([100, 105, 110], 118, { currency: "CNY" }),
    "0981.HK": yahooChart([60, 62, 64], 66, { currency: "HKD" }),
    "CNYHKD=X": yahooChart([1.08, 1.08, 1.08], 1.08, { currency: "HKD" }),
    "ZAR=X": yahooChart([17, 17.2, 17.4], 17.5, { currency: "ZAR" }),
  };

  // Every watchlist stock answers with the same small chart
  const withIdeas = async (s: string) => good[s] ?? yahooChart([10, 11, 12], 12.5);

  test("returns the chip quotes, then the watchlist, and a premium when everything answers", async () => {
    const r = await buildQuotesResponse(withIdeas);
    expect(r.quotes.map((q) => q.symbol)).toEqual(["ASML", "ASML.AS", "688981.SS", "0981.HK", ...WATCH_IDEAS.map((w) => w.symbol)]);
    // Rand per dollar: 17.5 now against yesterday's 17.2 close
    expect(r.usdZar).toMatchObject({ price: 17.5, prevClose: 17.2 });
    expect(r.usdZar?.changePct).toBeCloseTo(((17.5 - 17.2) / 17.2) * 100, 6);
    expect(r.quotes.find((q) => q.symbol === "NVDA")).toMatchObject({ company: "WATCH", exchange: "NASDAQ", price: 12.5 });
    expect(r.premium?.current).toBeCloseTo(((118 * 1.08) / 66 - 1) * 100, 6);
    expect(r.errors).toEqual({});
    expect(isQuotesResponse(r)).toBe(true);
  });

  test("a failed symbol degrades gracefully: other quotes stay, premium goes null, error is named", async () => {
    const r = await buildQuotesResponse(async (s) => {
      if (s === "0981.HK") throw new Error("HTTP 429");
      return withIdeas(s);
    });
    expect(r.quotes).toHaveLength(3 + WATCH_IDEAS.length);
    expect(r.premium).toBeNull();
    expect(r.errors["0981.HK"]).toContain("HTTP 429");
  });

  test("a symbol that fails once is retried, so a blip leaves no hole", async () => {
    const seen = new Set<string>();
    const r = await buildQuotesResponse(async (s) => {
      if (!seen.has(s)) {
        seen.add(s);
        throw new Error("HTTP 429");
      }
      return withIdeas(s);
    });
    expect(r.errors).toEqual({});
    expect(r.quotes).toHaveLength(4 + WATCH_IDEAS.length);
    expect(r.usdZar?.price).toBe(17.5);
  });

  test("everything failing yields no quotes", async () => {
    const r = await buildQuotesResponse(async () => {
      throw new Error("down");
    });
    expect(r.quotes).toEqual([]);
    expect(r.usdZar).toBeNull();
    expect(Object.keys(r.errors)).toHaveLength(6 + WATCH_IDEAS.length);
  });
});

describe("isQuotesResponse", () => {
  test("accepts a valid payload", () => {
    expect(isQuotesResponse(SAMPLE)).toBe(true);
    expect(isQuotesResponse({ ...SAMPLE, premium: null })).toBe(true);
  });

  test("rejects malformed payloads", () => {
    expect(isQuotesResponse(null)).toBe(false);
    expect(isQuotesResponse({ ...SAMPLE, quotes: [{ symbol: "X" }] })).toBe(false);
    expect(isQuotesResponse({ ...SAMPLE, generatedAt: "now" })).toBe(false);
    expect(isQuotesResponse({ ...SAMPLE, premium: { current: NaN, asOf: 1, series: [] } })).toBe(false);
  });
});

describe("corsHeaders", () => {
  test("grants nothing by default", () => {
    expect(corsHeaders("https://evil.example", undefined)).toEqual({ Vary: "Origin" });
  });

  test("never honours a wildcard", () => {
    expect(corsHeaders("https://a.example", "*")["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  test("allows exactly the configured origin", () => {
    const h = corsHeaders("http://localhost:5173", "http://localhost:5173");
    expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(h["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
    expect(corsHeaders("http://localhost:9999", "http://localhost:5173")["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  test("same-origin requests (no Origin header) need no CORS headers", () => {
    expect(corsHeaders(null, "http://localhost:5173")).toEqual({ Vary: "Origin" });
  });
});
