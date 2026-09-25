import { Dashboard } from "./Dashboard";
import { useNow } from "./hooks/useNow";
import { usePortfolio } from "./hooks/usePortfolio";
import { useQuotes } from "./hooks/useQuotes";

export default function App() {
  const { data, error, loading, refresh } = useQuotes();
  const portfolio = usePortfolio();
  const now = useNow(1000); // one-second tick drives the open/close countdowns
  return (
    <Dashboard
      data={data}
      error={error}
      loading={loading}
      now={now}
      onRefresh={refresh}
      portfolio={portfolio.data}
      portfolioError={portfolio.error}
      portfolioLoading={portfolio.loading}
    />
  );
}
