import { createHash } from "node:crypto";
import { MIN_PAGE_TEXT, PAGES, type PageSource } from "./config";
import { mentionsEntity } from "./classify";
import { errMsg, log } from "./log";
import type { FetchResult, Hit } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const sha1 = (s: string): string => createHash("sha1").update(s).digest("hex");

/**
 * Pure extraction (unit-tested). A hit is any line naming SMEE/AMIES, plus the next 3 lines,
 * which on list pages carry the status columns. The id covers that context, so a status
 * change (e.g. accepted -> inquiry) produces a new id and re-alerts.
 */
export function extractHits(src: PageSource, text: string): Hit[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const hits: Hit[] = [];
  lines.forEach((line, i) => {
    if (!mentionsEntity(line)) return;
    const context = lines.slice(i, i + 4).join(" | ");
    hits.push({
      id: sha1(`${src.url}::${context}`),
      title: context.slice(0, 300),
      url: src.url,
      source: src.name,
    });
  });
  return hits;
}

/** Guards against the classic silent failure: a blocked or half-rendered page that "matches nothing". */
export function assertHealthy(src: PageSource, text: string): void {
  if (text.length < MIN_PAGE_TEXT) {
    throw new Error(`page text only ${text.length} chars (blocked or not rendered?)`);
  }
  if (src.expectText && !text.includes(src.expectText)) {
    throw new Error(`expected marker "${src.expectText}" not found (data not loaded or layout changed?)`);
  }
}

export async function fetchPages(pages: PageSource[] = PAGES): Promise<FetchResult> {
  const result: FetchResult = { hits: [], ok: [], errors: {} };
  if (pages.length === 0) return result;

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    for (const src of pages) {
      const context = await browser.newContext({
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
        userAgent: UA,
      });
      try {
        const page = await context.newPage();
        await page.goto(src.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        // Condition-based wait (no fixed sleeps): let XHR-loaded tables settle.
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
          log.warn("networkidle not reached; reading what has rendered", { page: src.name });
        });
        const text = await page.locator("body").innerText({ timeout: 15_000 });
        assertHealthy(src, text);
        const hits = extractHits(src, text);
        result.hits.push(...hits);
        result.ok.push(src.name);
        log.debug("page ok", { page: src.name, textLength: text.length, matches: hits.length });
      } catch (e) {
        result.errors[src.name] = errMsg(e);
        log.warn("page failed", { page: src.name, error: errMsg(e) });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}
