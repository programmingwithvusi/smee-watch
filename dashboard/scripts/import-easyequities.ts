#!/usr/bin/env -S npx tsx
/**
 * Run this yourself, locally: `npm run import:easyequities -- path/to/export.csv`
 *
 * EasyEquities has no official API, so this reads a CSV you export yourself from the EasyEquities
 * site. Two export formats are understood, auto-detected from the header row:
 *
 * - Share trading (Transactions / Trade History -> Export/Download): "Contract Code", "Action",
 *   "Quantity", "Price", etc. Header names below are best-guess aliases; if the importer stops on
 *   "couldn't find a column for X", paste the header row it printed and extend HEADER_ALIASES.
 * - EasyCrypto (the crypto-currency portion of EasyEquities, a separate export): "Transaction
 *   Date", "Pair" (e.g. "BTC/ZAR"), "Transaction Type", "Quantity", "Price", "Price Currency",
 *   "Fees", "Fees Currency". Rows that aren't a Buy or Sell (a ZAR "Deposit", say) are skipped --
 *   they're not a trade and have no instrument to attach to a holding.
 *
 * Safe to re-run on the same file, or an export that overlaps a previous one: each row gets a
 * stable id from its own contents, so a row already in public/portfolio/trades.json is skipped,
 * not duplicated. Nothing is deleted -- only new rows are added.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeTrades, type Trade, type TradeSide } from "../shared/portfolio";
import { tradeId } from "../shared/tradeId";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "portfolio", "trades.json");

/** Logical field -> acceptable header spellings (case-insensitive, trimmed). Extend this if your
 *  export uses different column names -- the error message shows you exactly what was found. */
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "trade date", "settlement date", "transaction date"],
  symbol: ["contract code", "symbol", "ticker", "instrument", "share code", "stock code"],
  name: ["instrument name", "name", "description", "security name"],
  side: ["action", "type", "transaction type", "buy/sell", "side"],
  quantity: ["quantity", "shares", "units", "qty"],
  price: ["price", "unit price", "price per share", "share price"],
  currency: ["currency", "ccy"],
  fees: ["fees", "brokerage", "commission", "total fees"],
};

/** The EasyCrypto export's own header spellings -- distinct enough from the share-trading ones
 *  (notably "Pair") that the two formats are told apart by which columns are present at all. */
const CRYPTO_HEADER_ALIASES: Record<string, string[]> = {
  date: ["transaction date", "date"],
  pair: ["pair"],
  type: ["transaction type"],
  quantity: ["quantity"],
  price: ["price"],
  priceCurrency: ["price currency"],
  fees: ["fees"],
  feesCurrency: ["fees currency"],
};

/** Friendly names for common coins, so the dashboard doesn't have to show a bare ticker. Optional --
 *  an asset missing here just shows its symbol, same as before this map existed. */
const ASSET_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDC: "USD Coin",
  USDT: "Tether",
  SOL: "Solana",
  XRP: "XRP",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // skip; \r\n handled by the following \n
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
}

function findColumn(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const i = lower.indexOf(alias);
    if (i !== -1) return i;
  }
  return -1;
}

function parseSide(raw: string): TradeSide {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("buy") || s.startsWith("purchase")) return "buy";
  if (s.startsWith("sell") || s.startsWith("sale")) return "sell";
  throw new Error(`couldn't tell "${raw}" apart as buy or sell`);
}

/** Like parseSide, but a non-trade row (a Deposit, Withdrawal, etc.) is expected and common in the
 *  EasyCrypto export, so it's reported as "not a trade" rather than a parse failure. */
function parseCryptoSide(raw: string): TradeSide {
  const s = raw.trim().toLowerCase();
  if (s === "buy") return "buy";
  if (s === "sell") return "sell";
  throw new Error(`not a trade (${raw})`);
}

function parsePair(raw: string): { symbol: string; currency: string } {
  const parts = raw.trim().toUpperCase().split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`"${raw}" isn't a recognisable Pair (expected e.g. "BTC/ZAR")`);
  }
  return { symbol: parts[0]!, currency: parts[1]! };
}

function parseNumber(raw: string): number {
  const n = Number(raw.replace(/[, ]/g, "").replace(/^R/i, ""));
  if (!Number.isFinite(n)) throw new Error(`"${raw}" isn't a number`);
  return n;
}

function parseDate(raw: string): string {
  const s = raw.trim();
  // Accept YYYY-MM-DD as-is; otherwise try Date parsing (handles "12 Mar 2026", "2026/03/12",
  // "2026/09/25, 11:46:07", etc.)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`"${raw}" isn't a date I can parse`);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const csvPath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!csvPath) {
    console.error("Usage: npm run import:easyequities -- path/to/export.csv [--dry-run]");
    process.exitCode = 1;
    return;
  }

  const text = await readFile(path.resolve(csvPath), "utf8");
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("CSV has no data rows");

  const headers = rows[0]!;
  const isCrypto = findColumn(headers, CRYPTO_HEADER_ALIASES.pair!) !== -1 && findColumn(headers, CRYPTO_HEADER_ALIASES.type!) !== -1;

  const incoming: Trade[] = [];
  const skippedRows: string[] = [];

  if (isCrypto) {
    const col: Record<string, number> = {};
    const missing: string[] = [];
    for (const [field, aliases] of Object.entries(CRYPTO_HEADER_ALIASES)) {
      const idx = findColumn(headers, aliases);
      if (idx === -1 && field !== "priceCurrency" && field !== "fees" && field !== "feesCurrency") missing.push(field);
      col[field] = idx;
    }
    if (missing.length > 0) {
      throw new Error(
        `Couldn't find a column for: ${missing.join(", ")}.\n` +
          `Headers found in the file: ${headers.map((h) => `"${h}"`).join(", ")}\n` +
          `Add the real header name to CRYPTO_HEADER_ALIASES in scripts/import-easyequities.ts (or share the header row and it can be added there).`,
      );
    }
    for (const [i, r] of rows.slice(1).entries()) {
      try {
        const get = (field: string): string => r[col[field]!] ?? "";
        const { symbol, currency: pairCurrency } = parsePair(get("pair"));
        const currency = col.priceCurrency! >= 0 ? get("priceCurrency").trim().toUpperCase() || pairCurrency : pairCurrency;
        const trade: Omit<Trade, "id"> = {
          source: "easyequities",
          date: parseDate(get("date")),
          symbol,
          name: ASSET_NAMES[symbol],
          side: parseCryptoSide(get("type")),
          quantity: Math.abs(parseNumber(get("quantity"))),
          price: Math.abs(parseNumber(get("price"))),
          currency,
          fees: col.fees! >= 0 && get("fees").trim() !== "" ? parseNumber(get("fees")) : undefined,
        };
        incoming.push({ ...trade, id: tradeId(trade) });
      } catch (e) {
        skippedRows.push(`row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } else {
    const col: Record<string, number> = {};
    const missing: string[] = [];
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      const idx = findColumn(headers, aliases);
      if (idx === -1 && field !== "name" && field !== "currency" && field !== "fees") {
        missing.push(field);
      }
      col[field] = idx;
    }
    if (missing.length > 0) {
      throw new Error(
        `Couldn't find a column for: ${missing.join(", ")}.\n` +
          `Headers found in the file: ${headers.map((h) => `"${h}"`).join(", ")}\n` +
          `Add the real header name to HEADER_ALIASES in scripts/import-easyequities.ts (or share the header row and it can be added there).`,
      );
    }
    for (const [i, r] of rows.slice(1).entries()) {
      try {
        const get = (field: string): string => r[col[field]!] ?? "";
        const trade: Omit<Trade, "id"> = {
          source: "easyequities",
          date: parseDate(get("date")),
          symbol: get("symbol").trim().toUpperCase(),
          name: col.name! >= 0 ? get("name").trim() || undefined : undefined,
          side: parseSide(get("side")),
          quantity: Math.abs(parseNumber(get("quantity"))),
          price: Math.abs(parseNumber(get("price"))),
          currency: col.currency! >= 0 ? get("currency").trim().toUpperCase() || "ZAR" : "ZAR",
          fees: col.fees! >= 0 && get("fees").trim() !== "" ? parseNumber(get("fees")) : undefined,
        };
        incoming.push({ ...trade, id: tradeId(trade) });
      } catch (e) {
        skippedRows.push(`row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  let existing: Trade[] = [];
  try {
    const raw = await readFile(OUT_PATH, "utf8");
    existing = (JSON.parse(raw) as { trades: Trade[] }).trades;
  } catch {
    // no file yet -- starting fresh
  }

  const { merged, added, skipped } = mergeTrades(existing, incoming);

  console.log(`Parsed ${incoming.length} trade row(s) from ${csvPath} (${isCrypto ? "EasyCrypto" : "share trading"} format).`);
  if (skippedRows.length > 0) {
    console.log(`Skipped ${skippedRows.length} row(s):`);
    for (const s of skippedRows) console.log(`  ${s}`);
  }
  console.log(`${added} new, ${skipped} already on file.`);

  if (dryRun) {
    console.log("--dry-run: not writing. Re-run without --dry-run to save.");
    return;
  }

  if (added > 0) {
    await writeFile(OUT_PATH, JSON.stringify({ trades: merged }, null, 2) + "\n", "utf8");
    console.log(`Wrote ${OUT_PATH}`);
    console.log("Now: git add public/portfolio/trades.json && git commit && git push");
  } else {
    console.log("Nothing new to write.");
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
