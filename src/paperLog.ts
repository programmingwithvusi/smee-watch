import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * The paper-trading log: one entry per profit-banking suggestion, so we can later see what each
 * suggestion would have done. Nothing here is a real trade.
 *
 * It lives in the PUBLIC state/ folder, so it must never hold your quantities, cost basis or P&L:
 * only the symbol, the rung that fired, and the (public) market price at that moment.
 */
export type PaperStatus = "suggested" | "done" | "skipped";

export interface PaperEntry {
  id: string;
  ts: number;
  symbol: string;
  track: "core" | "speculative";
  rung: number;
  price: number;
  currency: string;
  slicePct: number;
  status: PaperStatus;
  decidedAt?: number;
}

export interface PaperFile {
  entries: PaperEntry[];
  /** Next Telegram update id to ask for, so a button press is processed once */
  telegramOffset: number;
}

const FILE = path.resolve(process.cwd(), "state", "paper-trades.json");

/** Short, stable id from the rung key: it has to fit in a 64-byte Telegram callback payload. */
export const paperId = (symbol: string, rung: number): string =>
  createHash("sha1").update(`bank:${symbol}:+${rung}%`).digest("hex").slice(0, 10);

function isEntry(v: unknown): v is PaperEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.ts === "number" &&
    typeof e.symbol === "string" &&
    (e.track === "core" || e.track === "speculative") &&
    typeof e.rung === "number" &&
    typeof e.price === "number" &&
    typeof e.currency === "string" &&
    typeof e.slicePct === "number" &&
    (e.status === "suggested" || e.status === "done" || e.status === "skipped") &&
    (e.decidedAt === undefined || typeof e.decidedAt === "number")
  );
}

/** Validates untrusted JSON from disk instead of trusting its shape. */
export function parsePaperFile(raw: string): PaperFile {
  const d = JSON.parse(raw) as { entries?: unknown; telegramOffset?: unknown };
  return {
    entries: Array.isArray(d.entries) ? d.entries.filter(isEntry) : [],
    telegramOffset: typeof d.telegramOffset === "number" && Number.isFinite(d.telegramOffset) ? d.telegramOffset : 0,
  };
}

/** Adds an entry unless that rung is already logged; returns whether it was new. */
export function addEntry(file: PaperFile, entry: PaperEntry): boolean {
  if (file.entries.some((e) => e.id === entry.id)) return false;
  file.entries.push(entry);
  return true;
}

/** Records the user's button press. A suggestion is decided once; later presses leave it alone. */
export function decide(file: PaperFile, id: string, status: "done" | "skipped", now: number): PaperEntry | null {
  const entry = file.entries.find((e) => e.id === id);
  if (!entry) return null;
  if (entry.status === "suggested") {
    entry.status = status;
    entry.decidedAt = now;
  }
  return entry;
}

export async function loadPaperFile(): Promise<{ file: PaperFile; save: () => Promise<void> }> {
  let before = "";
  let file: PaperFile = { entries: [], telegramOffset: 0 };
  try {
    before = await fs.readFile(FILE, "utf8");
    file = parsePaperFile(before);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return {
    file,
    save: async () => {
      const after = JSON.stringify(file, null, 2) + "\n";
      if (after === before) return;
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, after, "utf8");
    },
  };
}
