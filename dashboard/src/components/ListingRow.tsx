import type { QuoteDto } from "../../shared/types";
import type { WatchItem } from "../../shared/watchlist";
import { direction, formatLastTrade, formatPct, formatPrice } from "../lib/format";
import { EXCHANGES, marketState } from "../lib/sessions";
import { MarketBadge, MarketCountdown } from "./MarketStatus";
import { Sparkline } from "./Sparkline";

interface Props {
  item: WatchItem;
  quote: QuoteDto | undefined;
  now: Date;
}

const WORD = { up: "up", down: "down", flat: "unchanged" } as const;
const GLYPH = { up: "\u25B2", down: "\u25BC", flat: "\u25AC" } as const;

export function ListingRow({ item, quote, now }: Props) {
  const ex = EXCHANGES[item.exchange];
  const cls = `listing listing--${item.company.toLowerCase()}`;
  const state = marketState(item.exchange, now);

  if (!quote) {
    return (
      <article className={`${cls} listing--missing`} aria-label={item.label}>
        <h3 className="listing__name">{ex.name}</h3>
        <p className="listing__missing">Price unavailable right now. It will retry on the next refresh.</p>
        <div className="listing__foot">
          <MarketCountdown state={state} />
        </div>
      </article>
    );
  }

  const dir = direction(quote.changePct);
  return (
    <article className={cls} aria-label={item.label}>
      <header className="listing__head">
        <h3 className="listing__name">
          {ex.name} <span className="listing__ticker">{quote.symbol}</span>
        </h3>
        <MarketBadge state={state} />
      </header>
      <div className="listing__figures">
        <p className="listing__price">{formatPrice(quote.price, quote.currency)}</p>
        <p className={`listing__change is-${dir}`}>
          <span aria-hidden="true">{GLYPH[dir]}</span> {formatPct(quote.changePct)}
          <span className="sr-only"> {WORD[dir]} from the previous close</span>
        </p>
      </div>
      <div className="listing__trend">
        <Sparkline values={quote.series.map((p) => p.c)} label={`${item.label}: closing prices over the last month`} />
      </div>
      <footer className="listing__foot">
        <p className="listing__meta">Last trade {formatLastTrade(quote.lastTradeAt, now)}</p>
        <MarketCountdown state={state} />
      </footer>
    </article>
  );
}
