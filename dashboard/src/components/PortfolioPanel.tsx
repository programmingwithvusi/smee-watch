import { memo, useId, useState, type ReactNode } from "react";
import type { HoldingDto, PortfolioResponse } from "../../shared/portfolio";
import { direction, formatPct, formatPrice } from "../lib/format";
import { Sparkline } from "./Sparkline";

interface Props {
  data: PortfolioResponse | null;
  error: string | null;
  loading: boolean;
}

const WORD = { up: "up", down: "down", flat: "unchanged" } as const;
const GLYPH = { up: "▲", down: "▼", flat: "▬" } as const;

const qtyFmt = new Intl.NumberFormat("en", { maximumFractionDigits: 8 });
const dayFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const asOfFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Sum of live values per currency, e.g. "R703.07" or "R703.07 + $12.00". Null when nothing has a live price. */
function totalLabel(holdings: HoldingDto[]): string | null {
  const sums = new Map<string, number>();
  for (const h of holdings) {
    if (h.liveValue !== null && h.liveCurrency) sums.set(h.liveCurrency, (sums.get(h.liveCurrency) ?? 0) + h.liveValue);
  }
  if (sums.size === 0) return null;
  return [...sums].map(([cur, v]) => formatPrice(v, cur)).join(" + ");
}

function Change({ pct, suffix, sr }: { pct: number; suffix: string; sr: string }) {
  const dir = direction(pct);
  return (
    <p className={`listing__change is-${dir}`}>
      <span aria-hidden="true">{GLYPH[dir]}</span> {formatPct(pct)} <span className="listing__change-label">{suffix}</span>
      <span className="sr-only"> {WORD[dir]} {sr}</span>
    </p>
  );
}

/** Gain or loss on what was paid, in percent, when a cost basis in the live currency is known. */
function gainOnCost(h: HoldingDto): number | null {
  const cost = h.quantity * h.avgCost;
  if (h.liveValue === null || h.avgCost <= 0 || h.liveCurrency !== h.costCurrency || cost === 0) return null;
  return ((h.liveValue - cost) / cost) * 100;
}

/**
 * The body of a holding tile, laid out like a market listing: live value big, then today's change
 * and the gain on cost where they're known, a month's sparkline beside it, details in the foot.
 * `head` is the tile's title row, so the crypto tile can put its coin picker there.
 */
function HoldingTile({ h, head, share }: { h: HoldingDto; head: ReactNode; share?: number | null }) {
  const label = h.name ? `${h.symbol}, ${h.name}` : h.symbol;
  const hasLive = h.liveValue !== null && h.liveCurrency !== null;
  const gain = gainOnCost(h);
  const series = h.series ?? [];

  return (
    <article className={hasLive ? "listing listing--holding" : "listing listing--holding listing--nolive"} aria-label={label}>
      <header className="listing__head">{head}</header>
      <div className="listing__figures">
        {hasLive ? (
          <p className="listing__price">{formatPrice(h.liveValue!, h.liveCurrency!)}</p>
        ) : (
          <p className="listing__missing">No live price found for this holding.</p>
        )}
        {h.changePct != null && <Change pct={h.changePct} suffix="today" sr="from the previous close" />}
        {gain !== null && <Change pct={gain} suffix="on cost" sr="on what you paid" />}
      </div>
      {series.length >= 2 && (
        <div className="listing__trend">
          <Sparkline values={series.map((p) => p.c)} label={`${h.symbol}: value per unit over the last month`} />
        </div>
      )}
      <footer className="listing__foot">
        <p className="listing__meta">
          {qtyFmt.format(h.quantity)} {h.symbol}
          {h.livePrice !== null && h.liveCurrency && h.liveCurrency !== h.symbol && ` at ${formatPrice(h.livePrice, h.liveCurrency)} each`}
        </p>
        {h.avgCost > 0 ? (
          <p className="listing__meta">Cost {formatPrice(h.quantity * h.avgCost, h.costCurrency)}</p>
        ) : (
          share != null && <p className="listing__meta">{Math.round(share)}% of wallet</p>
        )}
      </footer>
    </article>
  );
}

function holdingName(h: HoldingDto) {
  return (
    <h3 className="listing__name">
      {h.symbol}
      {h.name && <span className="listing__ticker">{h.name}</span>}
    </h3>
  );
}

/** All the coins in one tile: a picker in the title row chooses which one it shows. Largest value first. */
function CoinPicker({ holdings }: { holdings: HoldingDto[] }) {
  const id = useId();
  const sorted = [...holdings].sort((a, b) => (b.liveValue ?? -1) - (a.liveValue ?? -1));
  const [symbol, setSymbol] = useState(sorted[0]?.symbol ?? "");
  const h = sorted.find((x) => x.symbol === symbol) ?? sorted[0];
  if (!h) return null;
  const zarTotal = holdings.reduce((sum, x) => sum + (x.liveCurrency === "ZAR" && x.liveValue !== null ? x.liveValue : 0), 0);
  const share = h.liveCurrency === "ZAR" && h.liveValue !== null && zarTotal > 0 ? (h.liveValue / zarTotal) * 100 : null;

  const head = (
    <>
      <label htmlFor={id} className="sr-only">Coin</label>
      <select id={id} className="picker" value={h.symbol} onChange={(e) => setSymbol(e.target.value)}>
        {sorted.map((x) => (
          <option key={x.symbol} value={x.symbol}>
            {x.symbol}
            {x.liveValue !== null && x.liveCurrency ? ` · ${formatPrice(x.liveValue, x.liveCurrency)}` : " · no live price"}
          </option>
        ))}
      </select>
      <p className="listing__meta">{sorted.length} coins</p>
    </>
  );
  return <HoldingTile h={h} head={head} share={share} />;
}

function HoldingColumn({
  id,
  name,
  role,
  holdings,
  empty,
  note,
  picker = false,
}: {
  id: string;
  name: string;
  role: string;
  holdings: HoldingDto[];
  empty: string;
  note?: string;
  /** Show every holding in one tile with a picker, rather than a tile each */
  picker?: boolean;
}) {
  const total = totalLabel(holdings);
  return (
    <section className={`col col--holdings col--${id}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="col__name">{name}</h2>
      <p className="col__role">
        {role}
        {total && (
          <>
            {" · "}
            <strong className="col__total">{total}</strong>
          </>
        )}
      </p>
      <div className="col__rows">
        {holdings.length === 0 ? (
          <article className="listing listing--missing">
            <p className="listing__missing">{empty}</p>
          </article>
        ) : picker ? (
          <CoinPicker holdings={holdings} />
        ) : (
          holdings.map((h) => <HoldingTile key={`${h.source}:${h.symbol}`} h={h} head={holdingName(h)} />)
        )}
      </div>
      {note && <p className="col__note">{note}</p>}
    </section>
  );
}

/** Your own holdings, distinct from the market watchlist above it. Reads whatever has been
 *  committed to public/portfolio/*.json — empty until you run the Luno snapshot or EasyEquities
 *  import scripts described in the README. Memoised: the page re-renders every second for the
 *  countdowns, but holdings only change with new data. */
export const PortfolioPanel = memo(function PortfolioPanel({ data, error, loading }: Props) {
  return (
    <section className="portfolio" aria-labelledby="portfolio-title">
      <h2 id="portfolio-title" className="portfolio__title">Your holdings</h2>
      <p className="portfolio__sub">
        From Luno and EasyEquities, as last committed to the repo. Not investment advice.
      </p>

      {error && (
        <p className="notice notice--soft" role="alert">
          {error}
        </p>
      )}

      {!data && loading && <p className="portfolio__empty">Loading holdings…</p>}

      {data && (
        <div className="stack stack--holdings">
          <HoldingColumn
            id="luno"
            name="Luno"
            role="Crypto wallet"
            holdings={data.luno.holdings}
            picker
            empty="No Luno snapshot yet. Run npm run luno:snapshot, then commit public/portfolio/luno-balance.json."
            note={data.luno.asOf ? `Balances as of ${asOfFmt.format(new Date(data.luno.asOf))}. Values use live Luno prices, or Yahoo Finance where Luno has none. Daily change is in rand, from Yahoo.` : undefined}
          />
          <HoldingColumn
            id="easyequities"
            name="EasyEquities"
            role="USD share account"
            holdings={data.easyequities.holdings}
            empty="No holdings yet. Add your positions to public/portfolio/easyequities-holdings.json (symbol, quantity and total cost), from a statement or the app."
            note={
              data.easyequities.asOf
                ? `Positions and cost as of ${dayFmt.format(new Date(data.easyequities.asOf))}, from your EasyEquities statement. Cost includes trading costs, not the EasyFX fee.`
                : data.easyequities.tradeCount > 0
                  ? `Built from ${data.easyequities.tradeCount} imported trade${data.easyequities.tradeCount === 1 ? "" : "s"}.`
                  : undefined
            }
          />
        </div>
      )}
    </section>
  );
});
