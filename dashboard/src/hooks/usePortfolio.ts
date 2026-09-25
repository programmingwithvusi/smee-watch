import { useCallback, useEffect, useRef, useState } from "react";
import { isPortfolioResponse, type PortfolioResponse } from "../../shared/portfolio";

export interface PortfolioState {
  data: PortfolioResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

function failureMessage(status: number, body: unknown): string {
  if (status === 404) {
    return "The portfolio service was not found at /api/portfolio. Run the app with npm run dev:netlify.";
  }
  if (typeof body === "object" && body !== null && "error" in body) return String((body as { error: unknown }).error);
  return `The portfolio service answered with HTTP ${status}.`;
}

async function load(signal: AbortSignal): Promise<PortfolioResponse> {
  const res = await fetch("/api/portfolio", { signal, headers: { Accept: "application/json" } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(failureMessage(res.status, body));
  if (!isPortfolioResponse(body)) throw new Error("The server sent portfolio data in an unexpected format.");
  return body;
}

/** Mirrors useQuotes: same polling/abort/visibility pattern, separate endpoint. */
export function usePortfolio(intervalMs = 60_000): PortfolioState {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setLoading(true);
    load(ctrl.signal)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, intervalMs);
    const onVisible = (): void => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      inFlight.current?.abort();
    };
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}
