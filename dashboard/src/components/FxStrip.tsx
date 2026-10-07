import { memo } from "react";
import { EASYFX_COST_PCT, easyFxRate } from "../../shared/easyequities";
import type { FxDto } from "../../shared/types";
import { direction, formatLastTrade, formatPct } from "../lib/format";
import { Sparkline } from "./Sparkline";

const money = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GLYPH = { up: "▲", down: "▼", flat: "▬" } as const;
/** The rate going up means a dollar costs more rand, which is the part that matters for buying US shares. */
const MEANING = { up: "rand weaker", down: "rand stronger", flat: "unchanged" } as const;

/** What a US dollar costs in rand right now: the price tag on every stock in the watchlist below it. */
export const FxStrip = memo(function FxStrip({ fx, now }: { fx: FxDto | null; now: Date }) {
  if (!fx) {
    return (
      <article className="listing listing--missing fx" aria-label="US dollar in rand">
        <h3 className="listing__name">US dollar <span className="listing__ticker">USD/ZAR</span></h3>
        <p className="listing__missing">The exchange rate is unavailable right now. It will retry on the next refresh.</p>
      </article>
    );
  }
  const dir = direction(fx.changePct);
  return (
    <article className="listing fx" aria-label="US dollar in rand">
      <header className="listing__head">
        <h3 className="listing__name">US dollar <span className="listing__ticker">USD/ZAR</span></h3>
        <p className="listing__meta">Updated {formatLastTrade(fx.lastTradeAt, now)}</p>
      </header>
      <div className="listing__figures fx__figures">
        <p className="listing__price">R{fx.price.toFixed(2)}</p>
        <p className={`listing__change is-${dir}`}>
          <span aria-hidden="true">{GLYPH[dir]}</span> {formatPct(fx.changePct)}{" "}
          <span className="listing__change-label">today, {MEANING[dir]}</span>
        </p>
      </div>
      <div className="listing__trend">
        <Sparkline values={fx.series.map((p) => p.c)} label="Rand per US dollar, daily, over the last month" />
      </div>
      <p className="fx__yours">
        <strong>R{easyFxRate(fx.price).toFixed(2)}</strong> on EasyEquities
        <span className="listing__change-label">
          {" "}
          · about {EASYFX_COST_PCT.toFixed(1)}% above the market rate, after EasyFX&rsquo;s rate margin and fee
        </span>
      </p>
      <footer className="listing__foot">
        <p className="listing__meta">
          $1 = R{fx.price.toFixed(4)} · $100 = R{money.format(fx.price * 100)} · R1,000 = ${money.format(1000 / fx.price)}
        </p>
      </footer>
    </article>
  );
});
