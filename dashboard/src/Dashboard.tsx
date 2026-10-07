import type { PortfolioResponse } from "../shared/portfolio";
import { WATCH_IDEAS, WATCHLIST } from "../shared/watchlist";
import type { ExchangeId, QuotesResponse } from "../shared/types";
import { FxStrip } from "./components/FxStrip";
import { ListingRow } from "./components/ListingRow";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { PremiumPanel } from "./components/PremiumPanel";
import { MarketBadge, MarketCountdown } from "./components/MarketStatus";
import { formatClock } from "./lib/format";
import { marketState } from "./lib/sessions";

interface Props {
  data: QuotesResponse | null;
  error: string | null;
  loading: boolean;
  now: Date;
  onRefresh: () => void;
  portfolio?: PortfolioResponse | null;
  portfolioError?: string | null;
  portfolioLoading?: boolean;
}

const ASML_ITEMS = WATCHLIST.filter((w) => w.company === "ASML");
const SMIC_ITEMS = WATCHLIST.filter((w) => w.company === "SMIC");
const US = new Set<ExchangeId>(["NASDAQ", "NYSE"]);

/** Pure view: everything it needs comes in as props, so it can be rendered and tested without a network. */
export function Dashboard({
  data,
  error,
  loading,
  now,
  onRefresh,
  portfolio = null,
  portfolioError = null,
  portfolioLoading = false,
}: Props) {
  const quoteFor = (symbol: string) => data?.quotes.find((q) => q.symbol === symbol);
  const failedCount = data ? Object.keys(data.errors).length : 0;

  return (
    <div className="page">
      <header className="bar">
        <h1 className="bar__title">Chip stack watch</h1>
        <div className="bar__actions">
          <p className="bar__updated" aria-live="polite">
            {data ? `Updated ${formatClock(data.generatedAt)}` : loading ? "Loading prices" : "No prices yet"}
          </p>
          <button type="button" className="btn" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="notice" role="alert">
          <p>
            {data
              ? `The latest refresh failed, so these are the prices from ${formatClock(data.generatedAt)}. ${error}`
              : `Prices could not be loaded. ${error}`}
          </p>
          <button type="button" className="btn btn--small" onClick={onRefresh}>Try again</button>
        </div>
      )}
      {failedCount > 0 && !error && (
        <p className="notice notice--soft">
          {failedCount} price feed{failedCount === 1 ? "" : "s"} did not answer. The rest are current.
        </p>
      )}

      <main className="stack">
        <section className="col col--asml" aria-labelledby="asml-title">
          <h2 id="asml-title" className="col__name">ASML</h2>
          <p className="col__role">Makes the lithography machines</p>
          <div className="col__rows">
            {ASML_ITEMS.map((w) => (
              <ListingRow key={w.symbol} item={w} quote={quoteFor(w.symbol)} now={now} />
            ))}
          </div>
          <aside className="about" aria-label="About this data">
            <p>Prices come from Yahoo Finance and can lag by up to 15 minutes.</p>
            <p>
              Open and closed times follow each exchange&rsquo;s regular schedule and ignore public holidays. If a
              market looks open but the price has not moved, check its last trade time.
            </p>
            <p>This page is for tracking, not investment advice.</p>
          </aside>
        </section>

        <section className="col col--smic" aria-labelledby="smic-title">
          <h2 id="smic-title" className="col__name">SMIC</h2>
          <p className="col__role">Makes chips for other companies</p>
          <div className="col__rows">
            {SMIC_ITEMS.map((w) => (
              <ListingRow key={w.symbol} item={w} quote={quoteFor(w.symbol)} now={now} />
            ))}
          </div>
          <PremiumPanel premium={data?.premium ?? null} />
        </section>
      </main>

      <section className="col col--watch watch" aria-labelledby="watch-title">
        <FxStrip fx={data?.usdZar ?? null} now={now} />
        <h2 id="watch-title" className="col__name">Watchlist</h2>
        <div className="watch__intro">
          <p className="col__role">Future trades, in your order of interest. Market times below are for Nasdaq and NYSE.</p>
          <div className="watch__market">
            <MarketBadge state={marketState("NASDAQ", now)} />
            <MarketCountdown state={marketState("NASDAQ", now)} />
          </div>
        </div>
        <div className="watch__grid">
          {WATCH_IDEAS.map((w) => (
            // US listings share the header's market status; anything else (ActivEX in Sydney) shows its own
            <ListingRow key={w.symbol} item={w} quote={quoteFor(w.symbol)} now={now} compact={US.has(w.exchange)} />
          ))}
        </div>
      </section>

      <PortfolioPanel data={portfolio} error={portfolioError} loading={portfolioLoading} />
    </div>
  );
}
