import { useCallback, useEffect, useState } from "react";
import { Dashboard } from "./Dashboard";
import { PortfolioPage } from "./components/PortfolioPage";
import { useNow } from "./hooks/useNow";
import { usePortfolio } from "./hooks/usePortfolio";
import { useQuotes } from "./hooks/useQuotes";
import { clearAccessCode, getAccessCode, saveAccessCode } from "./lib/accessCode";

const isPortfolioRoute = (): boolean => window.location.hash.replace(/^#\/?/, "").startsWith("portfolio");

export default function App() {
  const [onPortfolio, setOnPortfolio] = useState(isPortfolioRoute);
  useEffect(() => {
    const onHash = (): void => setOnPortfolio(isPortfolioRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const now = useNow(1000); // one-second tick drives the open/close countdowns
  return onPortfolio ? <PortfolioRoute /> : <WatchRoute now={now} />;
}

function WatchRoute({ now }: { now: Date }) {
  const { data, error, loading, refresh } = useQuotes();
  return <Dashboard data={data} error={error} loading={loading} now={now} onRefresh={refresh} />;
}

/** Only mounted on the portfolio page, so the private endpoint is never called from the main page. */
function PortfolioRoute() {
  const [code, setCode] = useState<string | null>(getAccessCode);
  const portfolio = usePortfolio(code);

  const unlock = useCallback((value: string) => {
    saveAccessCode(value);
    setCode(value);
  }, []);
  const lock = useCallback(() => {
    clearAccessCode();
    setCode(null);
  }, []);

  return <PortfolioPage portfolio={portfolio} code={code} onUnlock={unlock} onLock={lock} />;
}
