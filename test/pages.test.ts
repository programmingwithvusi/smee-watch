import { describe, expect, test } from "vitest";
import { assertHealthy, extractHits } from "../src/pages";

const SRC = { name: "SSE", url: "https://example.com/list", expectText: "科创板" };

describe("extractHits", () => {
  const text = ["科创板", "公司A", "已受理", "公司B", "上海微电子装备(集团)股份有限公司", "已问询", "2026-09-01", "保荐机构X", "公司C"].join("\n");

  test("finds the SMEE row and keeps the following status lines as context", () => {
    const hits = extractHits(SRC, text);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toContain("已问询");
    expect(hits[0]?.title).toContain("保荐机构X");
  });

  test("a status change produces a different id, so it re-alerts", () => {
    const changed = text.replace("已问询", "已上市委审议通过");
    expect(extractHits(SRC, changed)[0]?.id).not.toBe(extractHits(SRC, text)[0]?.id);
  });

  test("returns nothing when SMEE is absent", () => {
    expect(extractHits(SRC, "科创板\n公司A\n已受理")).toEqual([]);
  });
});

describe("assertHealthy", () => {
  test("rejects tiny pages", () => {
    expect(() => assertHealthy(SRC, "科创板")).toThrow(/blocked or not rendered/);
  });

  test("rejects pages missing the expected marker", () => {
    expect(() => assertHealthy(SRC, "x".repeat(400))).toThrow(/expected marker/);
  });

  test("accepts a healthy page", () => {
    expect(() => assertHealthy(SRC, "科创板" + "x".repeat(400))).not.toThrow();
  });
});
