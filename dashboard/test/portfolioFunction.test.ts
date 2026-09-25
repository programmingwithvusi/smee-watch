import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import portfolio from "../netlify/functions/portfolio";
import { isPortfolioResponse } from "../shared/portfolio";

const TRADES = {
  trades: [
    { id: "1", source: "easyequities", date: "2026-01-01", symbol: "ASML", side: "buy", quantity: 1, price: 900, currency: "USD" },
  ],
};
const LUNO_SNAP = { asOf: "2026-02-01T00:00:00.000Z", balances: [{ asset: "XBT", balance: 0.1, reserved: 0 }] };
const TICKERS = { tickers: [{ pair: "XBTZAR", last_trade: "1000000" }] };
const QUOTES = {
  generatedAt: 1,
  quotes: [{ symbol: "ASML", label: "ASML on Nasdaq", company: "ASML", exchange: "NASDAQ", currency: "USD", price: 1000, prevClose: 990, changePct: 1, lastTradeAt: 1, series: [] }],
  premium: null,
  errors: {},
};

type Mode = "ok" | "missing-files" | "luno-down";

function stub(mode: Mode): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("/portfolio/trades.json")) {
        return mode === "missing-files" ? new Response("nf", { status: 404 }) : new Response(JSON.stringify(TRADES));
      }
      if (url.includes("/portfolio/luno-balance.json")) {
        return mode === "missing-files" ? new Response("nf", { status: 404 }) : new Response(JSON.stringify(LUNO_SNAP));
      }
      if (url.includes("api.luno.com/api/1/tickers")) {
        return mode === "luno-down" ? new Response("down", { status: 503 }) : new Response(JSON.stringify(TICKERS));
      }
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
      { symbol: "XBT", source: "luno", quantity: 0.1, avgCost: 0, costCurrency: "ZAR", livePrice: 1_000_000, liveCurrency: "ZAR", liveValue: 100_000 },
    ]);

    expect(p.easyequities.tradeCount).toBe(1);
    expect(p.easyequities.holdings).toEqual([
      { symbol: "ASML", source: "easyequities", quantity: 1, avgCost: 900, costCurrency: "USD", livePrice: 1000, liveCurrency: "USD", liveValue: 1000 },
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

  test("Luno's public ticker being down still returns the balances, with no live value and a recorded error", async () => {
    stub("luno-down");
    const res = await portfolio(req());
    const body = (await res.json()) as import("../shared/portfolio").PortfolioResponse;
    expect(body.luno.holdings).toEqual([
      { symbol: "XBT", source: "luno", quantity: 0.1, avgCost: 0, costCurrency: "ZAR", livePrice: null, liveCurrency: null, liveValue: null },
    ]);
    expect(Object.keys(body.errors)).toContain("lunoTickers");
  });

  test("answers preflight with 204 and rejects other methods with 405", async () => {
    stub("ok");
    expect((await portfolio(req("https://site.test/api/portfolio", "OPTIONS"))).status).toBe(204);
    const post = await portfolio(req("https://site.test/api/portfolio", "POST"));
    expect(post.status).toBe(405);
  });
});
