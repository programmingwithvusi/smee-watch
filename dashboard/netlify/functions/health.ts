import type { Config } from "@netlify/functions";
import { createLogger } from "../../shared/log";
import { chartUrl } from "../../shared/yahoo";

/**
 * GET /api/health        -> process is up
 * GET /api/health?deep=1 -> also confirms the market-data upstream answers (503 if not)
 */
export default async (req: Request): Promise<Response> => {
  const log = createLogger(req.headers.get("x-nf-request-id") ?? crypto.randomUUID());
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };

  if (!deep) return new Response(JSON.stringify({ status: "UP" }), { status: 200, headers });

  try {
    const res = await fetch(chartUrl("ASML"), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; chip-dashboard/1.0)" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new Response(JSON.stringify({ status: "UP", upstream: "OK" }), { status: 200, headers });
  } catch (e) {
    log.warn("deep health check failed", { error: e instanceof Error ? e.message : String(e) });
    return new Response(JSON.stringify({ status: "DEGRADED", upstream: "DOWN" }), { status: 503, headers });
  }
};

export const config: Config = { path: "/api/health" };
