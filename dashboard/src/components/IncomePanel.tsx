import { memo } from "react";
import type { IncomeSummary } from "../../shared/portfolio";
import { formatPrice } from "../lib/format";

const money = (totals: Record<string, number>): string => {
  const parts = Object.entries(totals).map(([cur, v]) => formatPrice(v, cur));
  return parts.length ? parts.join(" + ") : "—";
};

/** Dividends and interest you actually received (from income.json in the private data repo).
 *  Totals are per currency — never converted, so no FX guesswork. */
export const IncomePanel = memo(function IncomePanel({ income }: { income?: IncomeSummary }) {
  const entries = income?.entries ?? [];
  return (
    <section className="portfolio" aria-labelledby="income-title">
      <h2 id="income-title" className="portfolio__title">Income received</h2>
      <p className="portfolio__sub">Dividends and interest you logged. Totals are per currency, not converted.</p>
      {!income || entries.length === 0 ? (
        <p className="portfolio__empty">
          Nothing logged yet. Run npm run income:add, then commit income.json in your private data repo.
        </p>
      ) : (
        <>
          <dl className="portfolio__stats">
            <div><dt>This month</dt><dd>{money(income.thisMonth)}</dd></div>
            <div><dt>Last 12 months</dt><dd>{money(income.last12Months)}</dd></div>
            <div><dt>Average / month</dt><dd>{money(income.avgPerMonth)}</dd></div>
          </dl>
          <ul className="portfolio__income">
            {entries.slice(0, 12).map((e, i) => (
              <li key={`${e.date}-${e.symbol}-${i}`}>
                {e.date} · {e.symbol} · {formatPrice(e.amount, e.currency)}
                {e.note ? ` · ${e.note}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
});
