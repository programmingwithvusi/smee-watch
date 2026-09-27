import { describe, expect, test } from "vitest";
import { lunoCostBasis, priceInZar, zarTrend } from "../shared/luno";
import { computeHoldings, isPortfolioResponse, mergeTrades, type Trade } from "../shared/portfolio";
import { tradeId } from "../shared/tradeId";

const buy = (over: Partial<Trade> = {}): Omit<Trade, "id"> => ({
  source: "easyequities",
  date: "2026-01-05",
  symbol: "ASML",
  side: "buy",
  quantity: 1,
  price: 1000,
  currency: "USD",
  ...over,
});

describe("computeHoldings", () => {
  test("a single buy becomes a holding at that cost", () => {
    const t: Trade = { id: "1", ...buy({ quantity: 2, price: 500 }) };
    const [h] = computeHoldings([t]);
    expect(h).toMatchObject({ symbol: "ASML", quantity: 2, avgCost: 500, costCurrency: "USD" });
  });

  test("two buys average the cost, weighted by quantity", () => {
    const trades: Trade[] = [
      { id: "1", ...buy({ date: "2026-01-01", quantity: 1, price: 100 }) },
      { id: "2", ...buy({ date: "2026-01-02", quantity: 1, price: 300 }) },
    ];
    const [h] = computeHoldings(trades);
    expect(h).toMatchObject({ quantity: 2, avgCost: 200 });
  });

  test("a sell reduces quantity but leaves the average cost of what remains unchanged", () => {
    const trades: Trade[] = [
      { id: "1", ...buy({ date: "2026-01-01", quantity: 4, price: 100 }) },
      { id: "2", ...buy({ date: "2026-01-02", side: "sell", quantity: 1, price: 999 }) },
    ];
    const [h] = computeHoldings(trades);
    expect(h).toMatchObject({ quantity: 3, avgCost: 100 });
  });

  test("selling everything drops the holding rather than showing zero", () => {
    const trades: Trade[] = [
      { id: "1", ...buy({ date: "2026-01-01", quantity: 1, price: 100 }) },
      { id: "2", ...buy({ date: "2026-01-02", side: "sell", quantity: 1, price: 150 }) },
    ];
    expect(computeHoldings(trades)).toEqual([]);
  });

  test("different symbols and different currencies for the same symbol stay separate", () => {
    const trades: Trade[] = [
      { id: "1", ...buy({ symbol: "ASML", currency: "USD" }) },
      { id: "2", ...buy({ symbol: "ASML", currency: "EUR", price: 900 }) },
      { id: "3", ...buy({ symbol: "SMIC" }) },
    ];
    expect(computeHoldings(trades)).toHaveLength(3);
  });

  test("order in the input doesn't matter; trades are processed oldest-first", () => {
    const a: Trade = { id: "1", ...buy({ date: "2026-02-01", quantity: 1, price: 100 }) };
    const b: Trade = { id: "2", ...buy({ date: "2026-01-01", quantity: 1, price: 300 }) };
    expect(computeHoldings([a, b])).toEqual(computeHoldings([b, a]));
  });
});

describe("tradeId", () => {
  test("is stable for identical content and differs for different content", () => {
    const t = buy();
    expect(tradeId(t)).toBe(tradeId({ ...t }));
    expect(tradeId(t)).not.toBe(tradeId({ ...t, quantity: 2 }));
  });
});

describe("mergeTrades", () => {
  test("skips ids already present and adds only new ones", () => {
    const existing: Trade[] = [{ id: "a", ...buy() }];
    const incoming: Trade[] = [{ id: "a", ...buy() }, { id: "b", ...buy({ date: "2026-01-06" }) }];
    const { merged, added, skipped } = mergeTrades(existing, incoming);
    expect(added).toBe(1);
    expect(skipped).toBe(1);
    expect(merged.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  test("re-running with the same file twice is a no-op the second time", () => {
    const batch: Trade[] = [{ id: "a", ...buy() }, { id: "b", ...buy({ date: "2026-01-06" }) }];
    const first = mergeTrades([], batch);
    const second = mergeTrades(first.merged, batch);
    expect(second.added).toBe(0);
    expect(second.skipped).toBe(2);
    expect(second.merged).toHaveLength(2);
  });
});

describe("priceInZar", () => {
  const tickers = [{ pair: "XBTZAR", last_trade: "1000000" }];

  test("values an asset against its ZAR pair", () => {
    expect(priceInZar("XBT", 0.5, tickers)).toBe(500_000);
  });

  test("ZAR itself is 1:1", () => {
    expect(priceInZar("ZAR", 250, tickers)).toBe(250);
  });

  test("an asset with no matching pair returns null rather than throwing", () => {
    expect(priceInZar("ETH", 1, tickers)).toBeNull();
  });
});

describe("isPortfolioResponse", () => {
  const valid = {
    generatedAt: 1,
    luno: { asOf: null, holdings: [] },
    easyequities: { holdings: [], tradeCount: 0 },
    errors: {},
  };

  test("accepts a well-formed empty response", () => {
    expect(isPortfolioResponse(valid)).toBe(true);
  });

  test("accepts a holding with live pricing", () => {
    const withHolding = {
      ...valid,
      luno: {
        asOf: "2026-01-01T00:00:00.000Z",
        holdings: [
          { symbol: "XBT", source: "luno", quantity: 1, avgCost: 0, costCurrency: "ZAR", livePrice: 1_000_000, liveCurrency: "ZAR", liveValue: 1_000_000 },
        ],
      },
    };
    expect(isPortfolioResponse(withHolding)).toBe(true);
  });

  test("rejects garbage", () => {
    expect(isPortfolioResponse(null)).toBe(false);
    expect(isPortfolioResponse({})).toBe(false);
    expect(isPortfolioResponse({ ...valid, generatedAt: "nope" })).toBe(false);
  });
});

describe("zarTrend", () => {
  const D = 86_400;
  test("carries Friday's USD→ZAR rate over the weekend and uses the live price for today", () => {
    // Fri, Sat, Sun closes in USD; FX only has Friday (stamped an hour before UTC midnight)
    const coin = [{ t: 0, c: 10 }, { t: D, c: 11 }, { t: 2 * D, c: 12 }];
    const fx = [{ t: -3600, c: 18 }];
    const trend = zarTrend(coin, fx, 13, 18);
    expect(trend?.series).toEqual([{ t: 0, c: 180 }, { t: D, c: 198 }, { t: 2 * D, c: 234 }]);
    expect(trend?.changePct).toBeCloseTo(((234 - 198) / 198) * 100, 6);
  });

  test("needs two priced days to report a change", () => {
    expect(zarTrend([{ t: 0, c: 10 }], [{ t: 0, c: 18 }], 10, 18)).toBeNull();
    expect(zarTrend([{ t: 0, c: 10 }, { t: D, c: 11 }], [], 11, 18)).toBeNull();
  });
});

describe("lunoCostBasis", () => {
  let row = 0;
  const e = (reference: string, currency: string, delta: number, kind = "EXCHANGE", timestamp = ++row) => ({
    reference,
    currency,
    delta,
    kind,
    timestamp,
    rowIndex: row,
  });

  test("averages instant buys, counting the ZAR fee as part of the price", () => {
    const basis = lunoCostBasis([
      e("a", "ZAR", -1000), e("a", "XBT", 0.001), e("a", "ZAR", -10, "FEE"),
      e("b", "ZAR", -3000), e("b", "XBT", 0.002),
    ]);
    // R4010 for 0.003 BTC
    expect(basis.get("XBT")).toBeCloseTo(4010 / 0.003, 6);
  });

  test("a coin fee reduces what you got, raising the price per unit", () => {
    const basis = lunoCostBasis([e("a", "ZAR", -1000), e("a", "SOL", 1), e("a", "SOL", -0.01, "FEE")]);
    expect(basis.get("SOL")).toBeCloseTo(1000 / 0.99, 6);
  });

  test("selling part keeps the average; rewards arrive at zero cost", () => {
    const basis = lunoCostBasis([
      e("a", "ZAR", -2000), e("a", "SOL", 2),
      e("b", "SOL", -1), e("b", "ZAR", 1500),
      e("c", "SOL", 1, "INTEREST"),
    ]);
    // 1 SOL left at R1000 cost, plus 1 free: R1000 for 2
    expect(basis.get("SOL")).toBeCloseTo(500, 6);
  });

  test("a coin that arrived by transfer or swap has no cost basis rather than a wrong one", () => {
    const basis = lunoCostBasis([
      e("a", "ZAR", -1000), e("a", "XBT", 0.001),
      e("t", "XBT", 0.5, "TRANSFER"),
      e("s", "USDC", -10), e("s", "JUP", 25),
    ]);
    expect(basis.has("XBT")).toBe(false);
    expect(basis.has("JUP")).toBe(false);
  });

  test("ZAR itself never gets a cost basis", () => {
    expect(lunoCostBasis([e("d", "ZAR", 5000, "TRANSFER")]).size).toBe(0);
  });
});
