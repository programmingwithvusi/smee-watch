import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ListingRow } from "../src/components/ListingRow";
import { OverlayTarget, overlayShift } from "../src/components/OverlayTarget";
import { PremiumPanel } from "../src/components/PremiumPanel";
import { direction, formatPct, formatPrice } from "../src/lib/format";
import { EXCHANGES, formatCountdown, formatDuration, marketState } from "../src/lib/sessions";
import { sparkGeometry } from "../src/lib/spark";
import { WATCH_IDEAS, WATCHLIST } from "../shared/watchlist";
import { failureMessage } from "../src/hooks/useQuotes";
import { SAMPLE } from "./fixtures";

// September 2026: New York is on EDT (UTC-4) and Amsterdam on CEST (UTC+2).
describe("marketState", () => {
  test("Nasdaq is open Monday 10:00 New York and counts down to the 16:00 close", () => {
    expect(marketState("NASDAQ", new Date("2026-09-21T14:00:00Z"))).toEqual({ open: true, secondsToChange: 6 * 3600 });
  });

  test("the countdown is second-accurate", () => {
    const s = marketState("NASDAQ", new Date("2026-09-21T14:00:15Z"));
    expect(s.secondsToChange).toBe(6 * 3600 - 15);
  });

  test("it flips to closed on the exact closing second", () => {
    expect(marketState("NASDAQ", new Date("2026-09-21T19:59:59Z"))).toEqual({ open: true, secondsToChange: 1 });
    expect(marketState("NASDAQ", new Date("2026-09-21T20:00:00Z")).open).toBe(false);
  });

  test("Nasdaq on Saturday noon counts down to Monday 09:30", () => {
    const s = marketState("NASDAQ", new Date("2026-09-19T16:00:00Z")); // Sat 12:00 EDT
    expect(s.open).toBe(false);
    expect(s.secondsToChange).toBe((2 * 24 * 60 - 150) * 60); // 2 days minus 2.5 hours
  });

  test("Shanghai is closed during the lunch break and reopens in an hour", () => {
    expect(marketState("SSE", new Date("2026-09-21T04:00:00Z"))).toEqual({ open: false, secondsToChange: 3600 }); // Mon 12:00 CST
  });

  test("Shanghai on Sunday evening opens Monday 09:30", () => {
    expect(marketState("SSE", new Date("2026-09-20T12:00:00Z"))).toEqual({ open: false, secondsToChange: 810 * 60 }); // Sun 20:00 CST
  });

  test("stays exact across a daylight-saving change over the weekend", () => {
    // US clocks go back Sunday 1 Nov 2026. Fri 17:00 EDT (21:00Z) to Mon 09:30 EST (14:30Z) is 65.5 hours,
    // an hour longer than the same wall-clock gap on an ordinary weekend.
    const s = marketState("NASDAQ", new Date("2026-10-30T21:00:00Z"));
    expect(s.open).toBe(false);
    expect(s.secondsToChange).toBe(65.5 * 3600);
  });

  test("countdown and state agree everywhere: the state flips exactly when the countdown hits zero", () => {
    // Sweeps 20 Oct - 5 Nov 2026, which spans both the European (25 Oct) and US (1 Nov) clock changes.
    const start = Date.parse("2026-10-20T00:00:00Z");
    const end = Date.parse("2026-11-05T00:00:00Z");
    let checked = 0;
    for (const id of Object.keys(EXCHANGES) as Array<keyof typeof EXCHANGES>) {
      for (let t = start; t < end; t += 37 * 60_000) {
        const s = marketState(id, new Date(t));
        expect(Number.isFinite(s.secondsToChange)).toBe(true);
        expect(s.secondsToChange).toBeGreaterThan(0);
        const at = t + s.secondsToChange * 1000;
        expect(marketState(id, new Date(at)).open).toBe(!s.open);
        expect(marketState(id, new Date(at - 1000)).open).toBe(s.open);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });

  test("every exchange has at least one window", () => {
    for (const ex of Object.values(EXCHANGES)) expect(ex.windows.length).toBeGreaterThan(0);
  });
});

describe("formatting", () => {
  test("durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(130)).toBe("2h 10m");
    expect(formatDuration(3000)).toBe("2d 2h");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(2880)).toBe("2d");
  });

  test("countdown digits", () => {
    expect(formatCountdown(6 * 3600)).toBe("06:00:00");
    expect(formatCountdown(59)).toBe("00:00:59");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(65.5 * 3600)).toBe("2d 17:30:00");
    expect(formatCountdown(-5)).toBe("00:00:00");
  });

  test("percent uses a real minus sign and explicit plus", () => {
    expect(formatPct(3.456)).toBe("+3.46%");
    expect(formatPct(-1)).toBe("\u22121.00%");
    expect(formatPct(63.84, 1)).toBe("+63.8%");
  });

  test("direction has a dead band so flat prices don't flicker green/red", () => {
    expect(direction(0.001)).toBe("flat");
    expect(direction(0.5)).toBe("up");
    expect(direction(-0.5)).toBe("down");
  });

  test("price formatting survives a bad currency code", () => {
    expect(formatPrice(12.3, "USD")).toContain("12.30");
    expect(formatPrice(12.3, "NOPE!")).toBe("12.30");
  });
});

describe("sparkGeometry", () => {
  test("draws rising data from bottom-left to top-right", () => {
    const g = sparkGeometry([1, 2, 3], 100, 40, 0);
    expect(g.path).toBe("M0.0 40.0 L50.0 20.0 L100.0 0.0");
    expect(g.last).toEqual({ x: 100, y: 0 });
  });

  test("a flat series is a centred line, not NaN", () => {
    expect(sparkGeometry([5, 5, 5], 100, 40, 0).path).not.toContain("NaN");
  });

  test("too little data draws nothing", () => {
    expect(sparkGeometry([1], 100, 40).path).toBe("");
  });
});

describe("overlay mark", () => {
  test("shift scales with the gap and clamps where the box meets the frame", () => {
    expect(overlayShift(0)).toBe(0);
    expect(overlayShift(50)).toBe(18);
    expect(overlayShift(250)).toBe(36);
    expect(overlayShift(-250)).toBe(-36);
  });

  test("renders the shifted box and an accessible description", () => {
    const html = renderToStaticMarkup(<OverlayTarget premiumPct={50} />);
    expect(html).toContain("translate(18.00 -18.00)");
    expect(html).toContain("Shanghai shares are 50.0 percent above Hong Kong shares");
  });
});

describe("components render real data", () => {
  test("a listing shows price, signed change, and a text alternative for direction", () => {
    const item = WATCHLIST[0]!;
    const html = renderToStaticMarkup(<ListingRow item={item} quote={SAMPLE.quotes[0]} now={new Date("2026-09-21T14:00:00Z")} />);
    expect(html).toContain("$1,048.20");
    expect(html).toContain("+2.61%");
    expect(html).toContain("up from the previous close");
    expect(html).toContain("Open, closes in 6h"); // screen-reader sentence
    expect(html).toContain("06:00:00"); // visible ticking digits
    expect(html).not.toContain("6h 0m");
  });

  test("a missing quote renders a placeholder instead of crashing", () => {
    const html = renderToStaticMarkup(<ListingRow item={WATCHLIST[3]!} quote={undefined} now={new Date()} />);
    expect(html).toContain("Price unavailable");
  });

  test("premium panel explains the gap in plain words, and handles no data", () => {
    const ok = renderToStaticMarkup(<PremiumPanel premium={SAMPLE.premium} />);
    expect(ok).toContain("costs 63.8% more");
    const none = renderToStaticMarkup(<PremiumPanel premium={null} />);
    expect(none).toContain("unavailable right now");
  });
});

describe("Dashboard states", () => {
  const now = new Date("2026-09-21T14:00:00Z");
  const noop = () => {};

  test("first load with nothing yet shows a loading label and placeholders, not a blank page", async () => {
    const { Dashboard } = await import("../src/Dashboard");
    const html = renderToStaticMarkup(<Dashboard data={null} error={null} loading now={now} onRefresh={noop} />);
    expect(html).toContain("Loading prices");
    expect(html).toContain("Price unavailable");
  });

  test("a failed refresh keeps the old prices and says so", async () => {
    const { Dashboard } = await import("../src/Dashboard");
    const html = renderToStaticMarkup(<Dashboard data={SAMPLE} error="HTTP 502" loading={false} now={now} onRefresh={noop} />);
    expect(html).toContain("latest refresh failed");
    expect(html).toContain("$1,048.20");
    expect(html).toContain('role="alert"');
  });

  test("a partial outage is called out without blocking the rest", async () => {
    const { Dashboard } = await import("../src/Dashboard");
    const partial = { ...SAMPLE, quotes: SAMPLE.quotes.slice(0, 3), premium: null, errors: { "0981.HK": "0981.HK: HTTP 429" } };
    const html = renderToStaticMarkup(<Dashboard data={partial} error={null} loading={false} now={now} onRefresh={noop} />);
    expect(html).toContain("1 price feed did not answer");
    expect(html).toContain("Price unavailable");
  });
});

describe("failureMessage", () => {
  test("a 404 tells you how to start the functions", () => {
    expect(failureMessage(404, null)).toContain("npm run dev:netlify");
  });

  test("uses the server's own explanation when it sends one", () => {
    expect(failureMessage(502, { error: "market data is unavailable right now" })).toBe("market data is unavailable right now");
  });

  test("falls back to the status code", () => {
    expect(failureMessage(500, null)).toContain("HTTP 500");
  });
});

describe("watchlist tiles", () => {
  test("penny-stock prices keep their decimals, and float noise isn't a signed zero", () => {
    expect(formatPrice(0.025, "AUD")).toBe("A$0.025");
    expect(formatPrice(1082.28, "USD")).toBe("$1,082.28");
    expect(formatPct(-0.0000015)).toBe("0.00%");
  });

  test("show the company, ticker and theme, and leave market status to the section", () => {
    const item = WATCH_IDEAS[0]!;
    const quote = { ...SAMPLE.quotes[0]!, symbol: item.symbol, label: item.label, company: "WATCH" as const };
    const html = renderToStaticMarkup(<ListingRow item={item} quote={quote} now={new Date("2026-09-21T14:00:00Z")} compact />);
    expect(html).toContain("NVIDIA");
    expect(html).toContain("NVDA");
    expect(html).toContain("Artificial intelligence · Nasdaq");
    expect(html).not.toContain("countdown");
    expect(html).not.toContain("badge");
  });
});
