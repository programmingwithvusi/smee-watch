/**
 * Your own trades and holdings, as distinct from `shared/types.ts` (the public market quotes).
 * Nothing here calls the network, and nothing here imports a Node built-in — this file is also
 * imported by the browser bundle (the PortfolioPanel/usePortfolio types), so it has to stay
 * browser-safe. The one thing that needs Node (hashing a trade id) lives in `shared/tradeId.ts`
 * instead, imported only by the import script.
 */

export type TradeSource = "luno" | "easyequities";
export type TradeSide = "buy" | "sell";

export interface Trade {
  /** Stable id derived from the trade's own fields, so re-importing the same CSV row is a no-op. */
  id: string;
  source: TradeSource;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** Ticker/contract code as the source reports it, e.g. "ASML", "AAPL", "XBT" */
  symbol: string;
  name?: string;
  side: TradeSide;
  /** Always positive; `side` carries direction */
  quantity: number;
  /** Per-unit price, in `currency` */
  price: number;
  currency: string;
  fees?: number;
}

export interface Holding {
  symbol: string;
  name?: string;
  source: TradeSource;
  quantity: number;
  /** Weighted-average cost per unit of what's still held, in `costCurrency`. Sells reduce quantity
   *  at the existing average rather than changing it — this is cost basis, not realised P&L. */
  avgCost: number;
  costCurrency: string;
}

const round = (n: number, dp = 6): number => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Aggregates a trade ledger into current holdings using weighted-average cost. Sells reduce
 * quantity and rescale the cost total so the average per unit is unchanged; a holding fully sold
 * is dropped rather than shown at zero. Realised profit/loss is intentionally out of scope.
 */
export function computeHoldings(trades: readonly Trade[]): Holding[] {
  interface Group {
    symbol: string;
    name: string | undefined;
    source: TradeSource;
    currency: string;
    qty: number;
    cost: number;
  }
  const groups = new Map<string, Group>();
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  for (const t of ordered) {
    const key = `${t.source}:${t.symbol}:${t.currency}`;
    const g = groups.get(key) ?? { symbol: t.symbol, name: t.name, source: t.source, currency: t.currency, qty: 0, cost: 0 };
    if (t.side === "buy") {
      g.cost += t.quantity * t.price + (t.fees ?? 0);
      g.qty += t.quantity;
    } else {
      const avg = g.qty > 1e-9 ? g.cost / g.qty : 0;
      g.qty -= t.quantity;
      g.cost = avg * Math.max(g.qty, 0);
    }
    if (t.name) g.name = t.name;
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter((g) => g.qty > 1e-9)
    .map((g) => ({
      symbol: g.symbol,
      name: g.name,
      source: g.source,
      quantity: round(g.qty),
      avgCost: round(g.cost / g.qty),
      costCurrency: g.currency,
    }));
}

/** Merges freshly-imported trades into an existing ledger, skipping any id already present. */
export function mergeTrades(
  existing: readonly Trade[],
  incoming: readonly Trade[],
): { merged: Trade[]; added: number; skipped: number } {
  const seen = new Set(existing.map((t) => t.id));
  const merged = [...existing];
  let added = 0;
  let skipped = 0;
  for (const t of incoming) {
    if (seen.has(t.id)) {
      skipped++;
      continue;
    }
    seen.add(t.id);
    merged.push(t);
    added++;
  }
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return { merged, added, skipped };
}

// ---- Response DTO shared between the Netlify function and the React app ----

export interface HoldingDto extends Holding {
  /** Live per-unit price if one could be found (Luno ticker, or a matching Yahoo quote), else null. */
  livePrice: number | null;
  liveCurrency: string | null;
  /** livePrice * quantity, in liveCurrency, when livePrice is known */
  liveValue: number | null;
}

export interface PortfolioResponse {
  generatedAt: number;
  luno: { asOf: string | null; holdings: HoldingDto[] };
  easyequities: { holdings: HoldingDto[]; tradeCount: number };
  /** Anything that went wrong fetching a live price, keyed by symbol; holdings still show cost basis. */
  errors: Record<string, string>;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string";

function isHoldingDto(v: unknown): v is HoldingDto {
  return (
    isObj(v) &&
    isStr(v.symbol) &&
    (v.source === "luno" || v.source === "easyequities") &&
    isNum(v.quantity) &&
    isNum(v.avgCost) &&
    isStr(v.costCurrency) &&
    (v.livePrice === null || isNum(v.livePrice)) &&
    (v.liveCurrency === null || isStr(v.liveCurrency)) &&
    (v.liveValue === null || isNum(v.liveValue))
  );
}

export function isPortfolioResponse(v: unknown): v is PortfolioResponse {
  if (!isObj(v) || !isNum(v.generatedAt)) return false;
  if (!isObj(v.luno) || !Array.isArray(v.luno.holdings) || !v.luno.holdings.every(isHoldingDto)) return false;
  if (v.luno.asOf !== null && !isStr(v.luno.asOf)) return false;
  if (!isObj(v.easyequities) || !Array.isArray(v.easyequities.holdings) || !v.easyequities.holdings.every(isHoldingDto)) {
    return false;
  }
  if (!isNum(v.easyequities.tradeCount)) return false;
  if (!isObj(v.errors)) return false;
  return true;
}
