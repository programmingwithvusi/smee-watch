import type { HoldingDto, PortfolioResponse } from "../../shared/portfolio";
import { formatPrice } from "../lib/format";

interface Props {
  data: PortfolioResponse | null;
  error: string | null;
  loading: boolean;
}

function HoldingRow({ h }: { h: HoldingDto }) {
  const costValue = h.quantity * h.avgCost;
  return (
    <tr>
      <td className="portfolio__symbol">
        {h.symbol}
        {h.name && <span className="portfolio__name"> {h.name}</span>}
      </td>
      <td>{h.quantity}</td>
      <td>{h.avgCost > 0 ? formatPrice(costValue, h.costCurrency) : "—"}</td>
      <td>
        {h.liveValue !== null && h.liveCurrency ? (
          formatPrice(h.liveValue, h.liveCurrency)
        ) : (
          <span className="portfolio__nolive" title="No live price found for this holding">
            no live price
          </span>
        )}
      </td>
    </tr>
  );
}

function HoldingTable({ title, holdings, empty }: { title: string; holdings: HoldingDto[]; empty: string }) {
  return (
    <div className="portfolio__group">
      <h3 className="portfolio__group-title">{title}</h3>
      {holdings.length === 0 ? (
        <p className="portfolio__empty">{empty}</p>
      ) : (
        <table className="portfolio__table">
          <thead>
            <tr>
              <th scope="col">Symbol</th>
              <th scope="col">Qty</th>
              <th scope="col">Cost basis</th>
              <th scope="col">Live value</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <HoldingRow key={`${h.source}:${h.symbol}`} h={h} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Your own holdings, distinct from the market watchlist above it. Reads whatever has been
 *  committed to public/portfolio/*.json — empty until you run the Luno snapshot or EasyEquities
 *  import scripts described in the README. */
export function PortfolioPanel({ data, error, loading }: Props) {
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
        <>
          <HoldingTable
            title="Luno"
            holdings={data.luno.holdings}
            empty="No Luno snapshot yet. Run npm run luno:snapshot, then commit public/portfolio/luno-balance.json."
          />
          {data.luno.asOf && <p className="portfolio__asof">Luno snapshot as of {new Date(data.luno.asOf).toLocaleString()}</p>}

          <HoldingTable
            title="EasyEquities"
            holdings={data.easyequities.holdings}
            empty="No trades imported yet. Export a CSV from EasyEquities, then run npm run import:easyequities -- path/to/export.csv."
          />
        </>
      )}
    </section>
  );
}
