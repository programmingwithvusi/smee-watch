#!/usr/bin/env -S npx tsx
/**
 * Log a dividend/interest payment: `npm run income:add -- STXDIV.JO 245.10 ZAR 2026-11-15 "Q3 payout"`
 * (date and note optional; date defaults to today). Appends to income.json in PORTFOLIO_DATA_PATH
 * (your PRIVATE data repo's portfolio/ folder — never commit income to the public repo).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isIncomeEntry, type IncomeFile } from "../shared/portfolio";

const [symbol, amountRaw, currency, dateArg, note] = process.argv.slice(2);
const date = dateArg ?? new Date().toISOString().slice(0, 10);
const entry = { date, symbol, amount: Number(amountRaw), currency: currency?.toUpperCase(), ...(note ? { note } : {}) };

if (!isIncomeEntry(entry) || entry.amount <= 0) {
  console.error('Usage: npm run income:add -- SYMBOL AMOUNT CURRENCY [YYYY-MM-DD] ["note"]');
  process.exit(1);
}

const dir = process.env.PORTFOLIO_DATA_PATH ?? path.join("public", "portfolio");
const file = path.join(dir, "income.json");
let data: IncomeFile = { entries: [] };
try {
  data = JSON.parse(await readFile(file, "utf8")) as IncomeFile;
} catch {
  /* first entry */
}
data.entries.push(entry);
data.entries.sort((a, b) => a.date.localeCompare(b.date));
await mkdir(dir, { recursive: true });
await writeFile(file, JSON.stringify(data, null, 2) + "\n");
console.log(`Logged ${entry.amount} ${entry.currency} from ${entry.symbol} on ${date} → ${file}\nNow commit it in the PRIVATE data repo.`);
