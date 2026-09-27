import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import portfolio from "../netlify/functions/portfolio";
import { isPortfolioResponse } from "../shared/portfolio";

const TRADES = {
  trades: [
    { id: "1", source: "easyequities", date: "2026-01-01", symbol: "ASML", side: "buy", quantity: 1, price: 900, currency: "USD" },
    { id: "2", source: "luno", date: "2026-01-02", symbol: "XBT", side: "buy", quantity: 0.1, price: 800_000, currency: "ZAR" },
  ],
};
const LUNO_SNAP = { asOf: "2026-02-01T00:00:00.000Z", balances: [{ asset: "XBT", balance: 0.1, reserved: 0 }] };
const COSTED_SNAP = { asOf: "2026-02-01T00:00:00.000Z", balances: [{ asset: "XBT", balance: 0.1, reserved: 0, avgCostZar: 500_000 }] };
const JUP_SNAP = { asOf: "2026-02-01T00:00:00.000Z", balances: [{ asset: "JUP", balance: 10, reserved: 0 }] };
const TICKERS = { tickers: [{ pair: "XBTZAR", last_trade: "1000000" }] };
const QUOTES = {
  generatedAt: 1,
  quotes: [{ symbol: "ASML", label: "ASML on Nasdaq", company: "ASML", exchange: "NASDAQ", currency: "USD", price: 1000, prevClose: 990, changePct: 1, lastTradeAt: 1, series: [] }],
  premium: null,
  errors: {},
};

const DAY = 86_400;
/** A Yahoo v8 chart body with one close per day, starting at UTC midnight. */
const chart = (closes: number[], price: number, start = 1_767_225_600) => ({
  chart: {
    result: [
      {
        meta: { regularMarketPrice: price, regularMarketTime: start + closes.length * DAY, currency: "USD" },
        timestamp: closes.map((_, i) => start + i * DAY),
        indicators: { quote: [{ close: closes }] },
      },
    ],
  },
});
// BTC 50k then 55k (live), USD→ZAR 20 both days (FX stamped an hour earlier, as Yahoo does): R1.0m → R1.1m, +10%
const BTC_USD = chart([50_000, 54_000], 55_000);
const USD_ZAR = chart([20, 20], 20, 1_767_225_600 - 3600);

type Mode = "ok" | "missing-files" | "luno-down" | "no-yahoo" | "jup" | "costed";

function stub(mode: Mode): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/portfolio/trades.json")) {
        return mode === "missing-files" ? new Response("nf", { status: 404 }) : new Response(JSON.stringify(TRADES));
      }
      if (url.includes("/portfolio/luno-balance.json")) {
        if (mode === "missing-files") return new Response("nf", { status: 404 });
        return new Response(JSON.stringify(mode === "jup" ? JUP_SNAP : mode === "costed" ? COSTED_SNAP : LUNO_SNAP));
      }
      if (url.includes("api.luno.com/api/1/tickers")) {
        return mode === "luno-down" ? new Response("down", { status: 503 }) : new Response(JSON.stringify(TICKERS));
      }
      if (mode === "no-yahoo" && url.includes("finance/chart/")) return new Response("down", { status: 503 });
      if (url.includes("finance/chart/JUP29210-USD")) return new Response(JSON.stringify(chart([0.3, 0.4], 0.5)));
      if (url.includes("finance/chart/BTC-USD")) return new Response(JSON.stringify(BTC_USD));
      if (url.includes("finance/chart/ZAR%3DX")) return new Response(JSON.stringify(USD_ZAR));
      if (url.includes("/api/quotes")) {
        return new Response(JSON.stringify(QUOTES));
      }
      return new Response("nf", { status: 404 });
    }),
  );
}

const req = (url = "https://site.test/api/portfolio", method = "GET") => new Request(url, { method });

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/portfolio", () => {
  test("combines committed trades, a Luno snapshot, live Luno pricing and a matching quote", async () => {
    stub("ok");
    const res = await portfolio(req());
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(isPortfolioResponse(body)).toBe(true);
    const p = body as import("../shared/portfolio").PortfolioResponse;

    expect(p.luno.asOf).toBe("2026-02-01T00:00:00.000Z");
    expect(p.luno.holdings).toEqual([
      {
        symbol: "XBT",
        source: "luno",
        quantity: 0.1,
        avgCost: 800_000,
        costCurrency: "ZAR",
        livePrice: 1_000_000,
        liveCurrency: "ZAR",
        liveValue: 100_000,
        changePct: expect.closeTo(10, 6),
        series: [
          { t: 1_767_225_600, c: 1_000_000 },
          { t: 1_767_225_600 + DAY, c: 1_100_000 },
        ],
      },
    ]);

    // Only EasyEquities trades build EasyEquities holdings; the Luno trade above is Luno's cost basis
    expect(p.easyequities.tradeCount).toBe(2);
    expect(p.easyequities.holdings).toEqual([
      { symbol: "ASML", source: "easyequities", quantity: 1, avgCost: 900, costCurrency: "USD", livePrice: 1000, liveCurrency: "USD", liveValue: 1000, changePct: 1, series: [] },
    ]);
  });

  test("no committed files yet is an empty portfolio, not an error", async () => {
    stub("missing-files");
    const res = await portfolio(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as import("../shared/portfolio").PortfolioResponse;
    expect(body.luno.holdings).toEqual([]);
    expect(body.easyequities.holdings).toEqual([]);
    expect(body.easyequities.tradeCount).toBe(0);
  });

  test("Luno's public ticker being down falls back to Yahoo's price, and records the error", async () => {
    stub("luno-down");
    const res = await portfolio(req());
    const body = (await res.json()) as import("../shared/portfolio").PortfolioResponse;
    expect(body.luno.holdings).toEqual([
      // 0.1 BTC at $55k live, R20 to the dollar
      expect.objectContaining({ symbol: "XBT", avgCost: 800_000, livePrice: 1_100_000, liveCurrency: "ZAR", liveValue: 110_000 }),
    ]);
    expect(Object.keys(body.errors)).toContain("lunoTickers");
  });

  test("a coin Yahoo can't price still shows, with no daily change and the failure recorded", async () => {
    stub("no-yahoo");
    const body = (await (await portfolio(req())).json()) as import("../shared/portfolio").PortfolioResponse;
    expect(body.luno.holdings).toEqual([expect.objectContaining({ symbol: "XBT", liveValue: 100_000, changePct: null, series: [] })]);
    expect(Object.keys(body.errors)).toContain("usdZar");
  });

  test("a coin with no ZAR pair on Luno is valued from Yahoo's USD price instead", async () => {
    stub("jup");
    const body = (await (await portfolio(req())).json()) as import("../shared/portfolio").PortfolioResponse;
    // 10 JUP at $0.50 live, R20 to the dollar
    expect(body.luno.holdings).toEqual([expect.objectContaining({ symbol: "JUP", liveValue: 100, livePrice: 10, liveCurrency: "ZAR" })]);
  });

  test("the snapshot's statement-based cost wins over trades.json", async () => {
    stub("costed");
    const body = (await (await portfolio(req())).json()) as import("../shared/portfolio").PortfolioResponse;
    expect(body.luno.holdings).toEqual([expect.objectContaining({ symbol: "XBT", avgCost: 500_000 })]);
  });

  test("answers preflight with 204 and rejects other methods with 405", async () => {
    stub("ok");
    expect((await portfolio(req("https://site.test/api/portfolio", "OPTIONS"))).status).toBe(204);
    const post = await portfolio(req("https://site.test/api/portfolio", "POST"));
    expect(post.status).toBe(405);
  });
});
