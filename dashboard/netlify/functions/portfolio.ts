import type { Config } from "@netlify/functions";
import { corsHeaders } from "../../shared/cors";
import { priceInZar, USD_ZAR_SYMBOL, YAHOO_USD_SYMBOL, zarTrend, type LunoBalanceSnapshot, type LunoTicker } from "../../shared/luno";
import { createLogger } from "../../shared/log";
import { computeHoldings, type HoldingDto, type PortfolioResponse, type Trade } from "../../shared/portfolio";
import { isQuotesResponse } from "../../shared/types";
import { chartUrl, parseChart, type ParsedChart } from "../../shared/yahoo";

const UA = "Mozilla/5.0 (compatible; chip-dashboard/1.0)";

interface TradesFile {
  trades: Trade[];
}

/** Same-origin static files under public/portfolio/ (committed to the repo, see the README). A
 *  missing file (nobody has run the import/snapshot script yet) is an empty result, not an error. */
async function fetchJsonOrEmpty<T>(url: string, fallback: T): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (res.status === 404) return fallback;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchLunoTickers(): Promise<LunoTicker[]> {
  const res = await fetch("https://api.luno.com/api/1/tickers", {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { tickers?: LunoTicker[] };
  return body.tickers ?? [];
}

async function fetchChart(symbol: string): Promise<ParsedChart> {
  const res = await fetch(chartUrl(symbol), {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseChart(await res.json());
}

/** Daily ZAR trend per Luno asset, from Yahoo's USD price and USD→ZAR rate. Failures are recorded in
 *  `errors` and leave that asset without a trend; they never fail the response. */
async function fetchZarTrends(assets: string[], errors: Record<string, string>): Promise<Map<string, ReturnType<typeof zarTrend>>> {
  const out = new Map<string, ReturnType<typeof zarTrend>>();
  const wanted = assets.flatMap((asset) => {
    const symbol = YAHOO_USD_SYMBOL[asset];
    return symbol ? [{ asset, symbol }] : [];
  });
  if (wanted.length === 0) return out;
  const [fx, coins] = await Promise.all([
    fetchChart(USD_ZAR_SYMBOL).then(
      (v) => v,
      (e: unknown) => {
        errors.usdZar = e instanceof Error ? e.message : String(e);
        return null;
      },
    ),
    Promise.allSettled(wanted.map((w) => fetchChart(w.symbol))),
  ]);
  if (!fx) return out;
  coins.forEach((c, i) => {
    const { asset } = wanted[i] ?? { asset: "" };
    if (c.status === "fulfilled") out.set(asset, zarTrend(c.value.series, fx.series, c.value.price, fx.price));
    else errors[asset] = c.reason instanceof Error ? c.reason.message : String(c.reason);
  });
  return out;
}

export default async (req: Request): Promise<Response> => {
  const started = Date.now();
  const log = createLogger(req.headers.get("x-nf-request-id") ?? crypto.randomUUID());
  const cors = corsHeaders(req.headers.get("origin"), process.env.ALLOWED_ORIGIN);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json", Allow: "GET, OPTIONS" },
    });
  }

  const origin = new URL(req.url).origin;
  const errors: Record<string, string> = {};

  const [tradesResult, lunoSnapResult, tickersResult, quotesResult] = await Promise.allSettled([
    fetchJsonOrEmpty<TradesFile>(`${origin}/portfolio/trades.json`, { trades: [] }),
    fetchJsonOrEmpty<LunoBalanceSnapshot>(`${origin}/portfolio/luno-balance.json`, { asOf: null, balances: [] }),
    fetchLunoTickers(),
    fetchJsonOrEmpty<unknown>(`${origin}/api/quotes`, null),
  ]);

  const tradesFile = tradesResult.status === "fulfilled" ? tradesResult.value : { trades: [] };
  if (tradesResult.status === "rejected") errors.trades = tradesResult.reason instanceof Error ? tradesResult.reason.message : String(tradesResult.reason);

  const lunoSnap = lunoSnapResult.status === "fulfilled" ? lunoSnapResult.value : { asOf: null, balances: [] };
  if (lunoSnapResult.status === "rejected") errors.luno = lunoSnapResult.reason instanceof Error ? lunoSnapResult.reason.message : String(lunoSnapResult.reason);

  const tickers = tickersResult.status === "fulfilled" ? tickersResult.value : [];
  if (tickersResult.status === "rejected") {
    errors.lunoTickers = tickersResult.reason instanceof Error ? tickersResult.reason.message : String(tickersResult.reason);
  }

  const quotes = quotesResult.status === "fulfilled" && isQuotesResponse(quotesResult.value) ? quotesResult.value : null;

  // Cost basis for Luno assets: the snapshot's avgCostZar (from your Luno statement), else any Luno
  // trades in trades.json; without either it stays 0 (unknown).
  const lunoCost = new Map(
    computeHoldings(tradesFile.trades.filter((t) => t.source === "luno" && t.currency === "ZAR")).map((h) => [h.symbol, h.avgCost]),
  );
  const lunoBalances = lunoSnap.balances.filter((b) => b.balance + b.reserved > 1e-9);
  const trends = await fetchZarTrends(
    lunoBalances.map((b) => b.asset),
    errors,
  );

  const lunoHoldings: HoldingDto[] = lunoBalances.map((b) => {
    const qty = b.balance + b.reserved;
    const trend = trends.get(b.asset) ?? null;
    // Luno's own price first; failing that (no <ASSET>ZAR pair on Luno), Yahoo's, converted to ZAR
    const valueZar = priceInZar(b.asset, qty, tickers) ?? (trend ? (trend.series.at(-1)?.c ?? 0) * qty : null);
    return {
      symbol: b.asset,
      source: "luno" as const,
      quantity: qty,
      avgCost: b.avgCostZar ?? lunoCost.get(b.asset) ?? 0,
      costCurrency: "ZAR",
      livePrice: valueZar !== null && qty > 0 ? valueZar / qty : null,
      liveCurrency: valueZar !== null ? "ZAR" : null,
      liveValue: valueZar,
      changePct: trend?.changePct ?? null,
      series: trend?.series ?? [],
    };
  });

  const eeHoldings: HoldingDto[] = computeHoldings(tradesFile.trades.filter((t) => t.source === "easyequities")).map((h) => {
    const match = quotes?.quotes.find((quote) => quote.symbol === h.symbol || quote.symbol.split(".")[0] === h.symbol);
    const livePrice = match ? match.price : null;
    return {
      ...h,
      livePrice,
      liveCurrency: match ? match.currency : null,
      liveValue: livePrice !== null ? livePrice * h.quantity : null,
      changePct: match ? match.changePct : null,
      series: match ? match.series : [],
    };
  });

  const body: PortfolioResponse = {
    generatedAt: Math.floor(Date.now() / 1000),
    luno: { asOf: lunoSnap.asOf, holdings: lunoHoldings },
    easyequities: { holdings: eeHoldings, tradeCount: tradesFile.trades.length },
    errors,
  };

  log.info("portfolio served", {
    lunoHoldings: lunoHoldings.length,
    eeHoldings: eeHoldings.length,
    errors: Object.keys(errors).length,
    durationMs: Date.now() - started,
  });

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
};

export const config: Config = { path: "/api/portfolio" };
