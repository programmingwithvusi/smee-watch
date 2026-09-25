import { useCallback, useEffect, useRef, useState } from "react";
import { isQuotesResponse, type QuotesResponse } from "../../shared/types";

export interface QuotesState {
  data: QuotesResponse | null;
  /** Message from the most recent failed refresh, cleared on the next success */
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/** Turns a failed response into a message that says what to do, not just what happened. */
export function failureMessage(status: number, body: unknown): string {
  if (status === 404) {
    return "The price service was not found at /api/quotes. Run the app with npm run dev:netlify so the Netlify functions are served.";
  }
  if (typeof body === "object" && body !== null && "error" in body) return String((body as { error: unknown }).error);
  return `The price service answered with HTTP ${status}.`;
}

async function load(signal: AbortSignal): Promise<QuotesResponse> {
  const res = await fetch("/api/quotes", { signal, headers: { Accept: "application/json" } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(failureMessage(res.status, body));
  if (!isQuotesResponse(body)) throw new Error("The server sent data in an unexpected format.");
  return body;
}

export function useQuotes(intervalMs = 60_000): QuotesState {
  const [data, setData] = useState<QuotesResponse | null>(null);
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
