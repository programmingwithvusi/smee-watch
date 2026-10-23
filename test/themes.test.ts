import { describe, expect, test } from "vitest";
import { describeThemes, mergeHeadlines, parseHeadlines, recentHeadlines } from "../src/headlines";
import { tagThemes } from "../src/themes";
import { formatContextItem } from "../src/context";
import type { Quote } from "../src/quotes";

const HOUR = 3600_000;
const NOW = Date.UTC(2026, 9, 23, 12, 0, 0);

describe("tagThemes", () => {
  test("tags the themes in a headline", () => {
    expect(tagThemes("Meta falls 7% as AI spending doubts revive tech selloff")).toContain("ai-spending");
    expect(tagThemes("Brent tops $112 after Houthi strikes on Saudi targets")).toContain("oil-geopolitics");
    expect(tagThemes("Traders price a Fed rate hike as 10-year yield nears 5.1%")).toContain("rates-inflation");
    expect(tagThemes("CSI 300 enters bear market despite Beijing stimulus")).toContain("china-trade");
    expect(tagThemes("Tesla earnings beat estimates")).toContain("earnings");
  });

  test("a headline can carry several themes, and unrelated ones none", () => {
    expect(tagThemes("Oil surge fuels inflation fears and a Fed rate hike")).toEqual(
      expect.arrayContaining(["oil-geopolitics", "rates-inflation"]),
    );
    expect(tagThemes("Local council approves new tram line")).toEqual([]);
  });
});

describe("mergeHeadlines", () => {
  const incoming = (id: string, title: string, published?: number) => ({ id, title, url: `https://x/${id}`, published });

  test("keeps only theme-matching headlines, dedupes, and uses the publish time", () => {
    const out = mergeHeadlines([], [incoming("a", "AI spending doubts hit chips", NOW - HOUR), incoming("b", "Tram line approved"), incoming("a", "AI spending doubts hit chips")], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]?.ts).toBe(NOW - HOUR);
  });

  test("falls back to now when the feed gave no time, and drops headlines older than 72h", () => {
    const old = { id: "o", title: "Oil jumps", url: "u", themes: ["oil-geopolitics" as const], ts: NOW - 80 * HOUR };
    const out = mergeHeadlines([old], [incoming("n", "Oil jumps again")], NOW);
    expect(out.map((h) => h.id)).toEqual(["n"]);
    expect(out[0]?.ts).toBe(NOW);
  });
});

describe("describeThemes / recentHeadlines", () => {
  test("ranks themes by count, quotes a sample, and says nothing when empty", () => {
    const mk = (id: string, title: string, themes: any[]) => ({ id, title, url: "u", themes, ts: NOW - HOUR });
    const recent = [mk("1", "AI spending doubts", ["ai-spending"]), mk("2", "AI capex worries", ["ai-spending"]), mk("3", "Oil climbs", ["oil-geopolitics"])];
    const line = describeThemes(recent);
    expect(line).toContain("AI spending (2)");
    expect(line).toContain("Oil & geopolitics (1)");
    expect(line).toContain("not proof of cause");
    expect(describeThemes([])).toBe("");
  });

  test("recentHeadlines applies the window", () => {
    const all = [
      { id: "1", title: "t", url: "u", themes: ["earnings" as const], ts: NOW - 2 * HOUR },
      { id: "2", title: "t", url: "u", themes: ["earnings" as const], ts: NOW - 50 * HOUR },
    ];
    expect(recentHeadlines(all, NOW, 36).map((h) => h.id)).toEqual(["1"]);
  });
});

describe("parseHeadlines", () => {
  test("drops malformed entries instead of trusting the file", () => {
    const raw = JSON.stringify({ items: [{ id: "1", title: "t", url: "u", themes: ["earnings"], ts: 1 }, { id: 2 }, { id: "3", title: "t", url: "u", themes: ["bogus"], ts: 1 }] });
    expect(parseHeadlines(raw).map((h) => h.id)).toEqual(["1"]);
    expect(parseHeadlines("{}")).toEqual([]);
  });
});

describe("formatContextItem", () => {
  const q = (price: number, prevClose: number): Quote => ({ symbol: "x", price, prevClose, changePct: ((price - prevClose) / prevClose) * 100, currency: "USD", day: "2026-10-22", closeHistory: [] });
  test("formats price, yield in basis points, and index", () => {
    expect(formatContextItem("WTI", "price", q(100.1, 97))).toBe("WTI $100.1 (+3.20%)");
    expect(formatContextItem("US 10y", "yield", q(5.077, 5.12))).toBe("US 10y 5.08% (-4bp)");
    expect(formatContextItem("VIX", "index", q(18.04, 16.4))).toBe("VIX 18.0 (+10.00%)");
  });
});
