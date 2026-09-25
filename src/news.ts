import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { NEWS_QUERIES, type NewsQuery } from "./config";
import { errMsg, log } from "./log";
import type { FetchResult, Hit } from "./types";

interface RawItem {
  title?: string;
  link?: string;
  guid?: string;
}

const UA = "Mozilla/5.0 (compatible; smee-watch/1.0)";
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

const sha1 = (s: string): string => createHash("sha1").update(s).digest("hex");

export function buildUrl(q: NewsQuery): string {
  const query = encodeURIComponent(`${q.q} when:14d`);
  return `https://news.google.com/rss/search?q=${query}&hl=${q.hl}&gl=${q.gl}&ceid=${encodeURIComponent(q.ceid)}`;
}

/** Pure parser so it can be unit-tested without the network. */
export function parseRss(xml: string, source: string): Hit[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RawItem | RawItem[] } } };
  const raw = doc.rss?.channel?.item;
  if (raw === undefined) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const hits: Hit[] = [];
  for (const it of items) {
    const title = it.title?.trim();
    const url = it.link?.trim();
    if (!title || !url) continue;
    hits.push({ id: sha1(it.guid?.trim() || url), title, url, source });
  }
  return hits;
}

export async function fetchNews(queries: NewsQuery[] = NEWS_QUERIES): Promise<FetchResult> {
  const result: FetchResult = { hits: [], ok: [], errors: {} };
  const seenIds = new Set<string>();

  for (const q of queries) {
    try {
      const res = await fetch(buildUrl(q), {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const hits = parseRss(await res.text(), q.label);
      for (const h of hits) {
        if (seenIds.has(h.id)) continue;
        seenIds.add(h.id);
        result.hits.push(h);
      }
      result.ok.push(q.label);
      log.debug("news query ok", { query: q.label, items: hits.length });
    } catch (e) {
      result.errors[q.label] = errMsg(e);
      log.warn("news query failed", { query: q.label, error: errMsg(e) });
    }
  }
  return result;
}
