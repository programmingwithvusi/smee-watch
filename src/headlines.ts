import { promises as fs } from "node:fs";
import path from "node:path";
import { tagThemes, themeLabel, type ThemeId } from "./themes";

/** A market headline with the themes it was tagged with, kept briefly so alerts can cite recent news. */
export interface StoredHeadline {
  id: string;
  title: string;
  url: string;
  themes: ThemeId[];
  /** Publication time if the feed gave one, otherwise when we first saw it (epoch ms) */
  ts: number;
}

export const HEADLINE_RETENTION_HOURS = 72;
const HOUR = 60 * 60 * 1000;
const FILE = path.resolve(process.cwd(), "state", "headlines.json");

const VALID_THEMES = new Set<string>(["ai-spending", "oil-geopolitics", "rates-inflation", "china-trade", "earnings"]);

function isHeadline(v: unknown): v is StoredHeadline {
  if (typeof v !== "object" || v === null) return false;
  const h = v as Record<string, unknown>;
  return (
    typeof h.id === "string" &&
    typeof h.title === "string" &&
    typeof h.url === "string" &&
    typeof h.ts === "number" &&
    Array.isArray(h.themes) &&
    h.themes.every((t) => typeof t === "string" && VALID_THEMES.has(t))
  );
}

/** Validates untrusted JSON from disk instead of trusting its shape. */
export function parseHeadlines(raw: string): StoredHeadline[] {
  const data: unknown = JSON.parse(raw);
  const items = (data as { items?: unknown })?.items;
  return Array.isArray(items) ? items.filter(isHeadline) : [];
}

/** Adds new headlines (deduped by id, only ones that matched at least one theme) and drops old ones. */
export function mergeHeadlines(
  existing: readonly StoredHeadline[],
  incoming: ReadonlyArray<{ id: string; title: string; url: string; published?: number }>,
  now: number,
): StoredHeadline[] {
  const byId = new Map(existing.map((h) => [h.id, h]));
  for (const h of incoming) {
    if (byId.has(h.id)) continue;
    const themes = tagThemes(h.title);
    if (themes.length === 0) continue;
    byId.set(h.id, { id: h.id, title: h.title, url: h.url, themes, ts: h.published ?? now });
  }
  const cutoff = now - HEADLINE_RETENTION_HOURS * HOUR;
  return [...byId.values()].filter((h) => h.ts >= cutoff).sort((a, b) => b.ts - a.ts);
}

export function recentHeadlines(all: readonly StoredHeadline[], now: number, hours: number): StoredHeadline[] {
  const cutoff = now - hours * HOUR;
  return all.filter((h) => h.ts >= cutoff);
}

/**
 * One alert line naming the themes most present in recent headlines, with a sample headline for
 * the top theme. Empty string when there is nothing to say (never invents a reason).
 */
export function describeThemes(recent: readonly StoredHeadline[]): string {
  const counts = new Map<ThemeId, number>();
  for (const h of recent) for (const t of h.themes) counts.set(t, (counts.get(t) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (ranked.length === 0) return "";
  const top = ranked[0]![0];
  const sample = recent.find((h) => h.themes.includes(top));
  const list = ranked.map(([t, n]) => `${themeLabel(t)} (${n})`).join(", ");
  return `📰 Recent headline themes: ${list}.${sample ? ` e.g. "${sample.title}"` : ""} A theme near a move is a lead, not proof of cause.`;
}

export async function loadHeadlines(): Promise<StoredHeadline[]> {
  try {
    return parseHeadlines(await fs.readFile(FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function saveHeadlines(items: readonly StoredHeadline[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify({ items }, null, 2) + "\n", "utf8");
}
