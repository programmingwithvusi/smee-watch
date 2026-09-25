import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import health from "../netlify/functions/health";
import quotes from "../netlify/functions/quotes";
import { isQuotesResponse } from "../shared/types";
import { yahooChart } from "./fixtures";

const charts: Record<string, unknown> = {
  ASML: yahooChart([1000, 1010, 1020], 1050),
  "ASML.AS": yahooChart([880, 885, 890], 893, { currency: "EUR" }),
  "688981.SS": yahooChart([100, 105, 110], 118, { currency: "CNY" }),
  "0981.HK": yahooChart([60, 62, 64], 66, { currency: "HKD" }),
  "CNYHKD=X": yahooChart([1.08, 1.08, 1.08], 1.08, { currency: "HKD" }),
};

function stubYahoo(mode: "ok" | "down"): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      if (mode === "down") return new Response("nope", { status: 503 });
      const symbol = decodeURIComponent(String(input).match(/chart\/([^?]+)\?/)?.[1] ?? "");
      const body = charts[symbol];
      return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("nf", { status: 404 });
    }),
  );
}

const req = (method = "GET", headers: Record<string, string> = {}, url = "https://site.test/api/quotes") =>
  new Request(url, { method, headers });

beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ALLOWED_ORIGIN;
});

describe("GET /api/quotes", () => {
  test("serves a valid payload with CDN caching and no CORS grant by default", async () => {
    stubYahoo("ok");
    const res = await quotes(req("GET", { origin: "https://evil.example" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("netlify-cdn-cache-control")).toContain("s-maxage=30");
    const body: unknown = await res.json();
    expect(isQuotesResponse(body)).toBe(true);
  });

  test("grants CORS to exactly the configured origin", async () => {
    stubYahoo("ok");
    process.env.ALLOWED_ORIGIN = "http://localhost:5173";
    const res = await quotes(req("GET", { origin: "http://localhost:5173" }));
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  test("answers preflight with 204 and rejects other methods with 405", async () => {
    expect((await quotes(req("OPTIONS"))).status).toBe(204);
    const post = await quotes(req("POST"));
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, OPTIONS");
  });

  test("returns 502 and is never cached when every upstream call fails", async () => {
    stubYahoo("down");
    const res = await quotes(req());
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("logs structured JSON with a correlation id", async () => {
    stubYahoo("ok");
    const out = vi.spyOn(process.stdout, "write");
    await quotes(req("GET", { "x-nf-request-id": "abc-123" }));
    const line = JSON.parse(String(out.mock.calls.at(-1)?.[0]));
    expect(line).toMatchObject({ level: "info", correlationId: "abc-123", message: "quotes served" });
  });
});

describe("GET /api/health", () => {
  test("shallow check needs no upstream", async () => {
    const res = await health(req("GET", {}, "https://site.test/api/health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "UP" });
  });

  test("deep check reports 503 when the market-data upstream is down", async () => {
    stubYahoo("down");
    const res = await health(req("GET", {}, "https://site.test/api/health?deep=1"));
    expect(res.status).toBe(503);
  });

  test("deep check is 200 when the upstream answers", async () => {
    stubYahoo("ok");
    const res = await health(req("GET", {}, "https://site.test/api/health?deep=1"));
    expect(res.status).toBe(200);
  });
});
