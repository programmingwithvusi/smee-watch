import { memo } from "react";
import type { PremiumDto } from "../../shared/types";
import { formatPct } from "../lib/format";
import { OverlayTarget } from "./OverlayTarget";
import { Sparkline } from "./Sparkline";

/** Memoised: the page re-renders every second for the countdowns, but this panel only changes with new data. */
export const PremiumPanel = memo(function PremiumPanel({ premium }: { premium: PremiumDto | null }) {
  if (!premium) {
    return (
      <section className="premium premium--missing" aria-labelledby="premium-title">
        <h3 id="premium-title" className="premium__title">Shanghai vs Hong Kong price</h3>
        <p className="premium__body">
          The gap needs both SMIC prices and the yuan-to-Hong-Kong-dollar rate. One of them is unavailable right now.
        </p>
      </section>
    );
  }

  const p = premium.current;
  const word = p >= 0 ? "more" : "less";
  return (
    <section className="premium" aria-labelledby="premium-title">
      <OverlayTarget premiumPct={p} />
      <div className="premium__text">
        <h3 id="premium-title" className="premium__title">Shanghai vs Hong Kong price</h3>
        <p className="premium__value">{formatPct(p, 1)}</p>
        <p className="premium__body">
          A SMIC share bought in Shanghai costs {Math.abs(p).toFixed(1)}% {word} than one bought in Hong Kong, after
          converting currencies.
        </p>
        <div className="premium__trend">
          <Sparkline
            values={premium.series.map((s) => s.c)}
            label="Shanghai versus Hong Kong price gap, daily, over the last month"
            width={200}
            height={40}
          />
          <p className="premium__caption">Daily gap over the last month</p>
        </div>
        <dl className="premium__key">
          <div>
            <dt><span className="swatch swatch--frame" aria-hidden="true" /> Frame</dt>
            <dd>Hong Kong price</dd>
          </div>
          <div>
            <dt><span className="swatch swatch--box" aria-hidden="true" /> Box</dt>
            <dd>Shanghai price. It touches the frame at a 100% gap.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
});
