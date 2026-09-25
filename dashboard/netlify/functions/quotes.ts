import type { Config } from "@netlify/functions";
import { buildQuotesResponse } from "../../shared/build";
import { corsHeaders } from "../../shared/cors";
import { createLogger } from "../../shared/log";
import { chartUrl } from "../../shared/yahoo";

const UA = "Mozilla/5.0 (compatible; chip-dashboard/1.0)";

async function fetchChart(symbol: string): Promise<unknown> {
  const res = await fetch(chartUrl(symbol), {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async (req: Request): Promise<Response> => {
  const started = Date.now();
  const log = createLogger(req.headers.get("x-nf-request-id") ?? crypto.randomUUID());
  const cors = corsHeaders(req.headers.get("origin"), process.env.ALLOWED_ORIGIN);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json", Allow: "GET, OPTIONS" },
    });
  }

  try {
    const body = await buildQuotesResponse(fetchChart);
    const failed = Object.keys(body.errors).length;

    if (body.quotes.length === 0) {
      log.error("all quote fetches failed", { errors: body.errors, durationMs: Date.now() - started });
      return new Response(JSON.stringify({ error: "market data is unavailable right now", errors: body.errors }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    log.info("quotes served", { quotes: body.quotes.length, failed, durationMs: Date.now() - started });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    log.error("unhandled error", { error: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
};

export const config: Config = { path: "/api/quotes" };
