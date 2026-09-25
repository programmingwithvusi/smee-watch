import { describe, expect, test } from "vitest";
import { buildUrl, parseRss } from "../src/news";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>x</title>
<item><title>上海微电子 拟借壳上市 - 某财经</title><link>https://example.com/a</link><guid isPermaLink="false">A1</guid></item>
<item><title>Second story - Wire</title><link>https://example.com/b</link></item>
<item><title></title><link>https://example.com/empty</link></item>
</channel></rss>`;

const SINGLE = `<rss><channel><item><title>Only one</title><link>https://example.com/only</link></item></channel></rss>`;

describe("parseRss", () => {
  test("parses items, skips ones without a title, and gives stable ids", () => {
    const hits = parseRss(SAMPLE, "q");
    expect(hits).toHaveLength(2);
    expect(hits[0]?.title).toBe("上海微电子 拟借壳上市 - 某财经");
    expect(hits[0]?.source).toBe("q");
    expect(parseRss(SAMPLE, "q")[0]?.id).toBe(hits[0]?.id);
  });

  test("handles a feed with a single item and an empty feed", () => {
    expect(parseRss(SINGLE, "q")).toHaveLength(1);
    expect(parseRss("<rss><channel></channel></rss>", "q")).toEqual([]);
  });
});

describe("buildUrl", () => {
  test("encodes the query and locale", () => {
    const url = buildUrl({ label: "l", q: "上海微电子 上市", hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans" });
    expect(url).toContain("https://news.google.com/rss/search?q=");
    expect(url).toContain(encodeURIComponent("上海微电子 上市"));
    expect(url).toContain("hl=zh-CN");
  });
});
