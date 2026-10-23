import { useCallback, useEffect, useRef, useState } from "react";
import { isPortfolioResponse, type PortfolioResponse } from "../../shared/portfolio";

export interface PortfolioState {
  data: PortfolioResponse | null;
  error: string | null;
  loading: boolean;
  /** True when the server refused: no access code yet, or the one given is wrong */
  locked: boolean;
  refresh: () => void;
}

class LockedError extends Error {}

function failureMessage(status: number, body: unknown): string {
  if (status === 404) {
    return "The portfolio service was not found at /api/portfolio. Run the app with npm run dev:netlify.";
  }
  if (typeof body === "object" && body !== null && "error" in body) return String((body as { error: unknown }).error);
  return `The portfolio service answered with HTTP ${status}.`;
}

async function load(signal: AbortSignal, code: string): Promise<PortfolioResponse> {
  const res = await fetch("/api/portfolio", {
    signal,
    headers: { Accept: "application/json", Authorization: `Bearer ${code}` },
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.status === 401) throw new LockedError("That access code was not accepted.");
  if (!res.ok) throw new Error(failureMessage(res.status, body));
  if (!isPortfolioResponse(body)) throw new Error("The server sent portfolio data in an unexpected format.");
  return body;
}

/**
 * Mirrors useQuotes: same polling/abort/visibility pattern, separate endpoint. Does nothing until
 * it has an access code, so the main page never calls the private endpoint at all.
 */
export function usePortfolio(code: string | null, intervalMs = 60_000): PortfolioState {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (!code) return;
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setLoading(true);
    load(ctrl.signal, code)
      .then((d) => {
        setData(d);
        setError(null);
        setLocked(false);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        if (e instanceof LockedError) {
          setData(null);
          setLocked(true);
          setError(e.message);
          return;
        }
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [code]);

  useEffect(() => {
    if (!code) {
      setData(null);
      setError(null);
      setLocked(false);
      return;
    }
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
  }, [refresh, intervalMs, code]);

  return { data, error, loading, locked, refresh };
}
