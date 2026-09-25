#!/usr/bin/env -S npx tsx
/**
 * Run this yourself, locally: `npm run luno:snapshot`.
 *
 * Fetches your Luno balances with a read-only API key and writes public/portfolio/luno-balance.json
 * — the file the dashboard (via the /api/portfolio function) reads to show your crypto holdings.
 * The API key never leaves your machine and is never committed: it's read from environment
 * variables you set locally (see .env.example), and only the resulting balance NUMBERS are written
 * to the JSON file you then `git add`/`git commit`/`git push` yourself.
 *
 * What you need on the Luno side: Settings → API Keys → Create API Key, with ONLY the
 * "Perm_R_Balance" (read balance) permission ticked. Do not grant trade or withdraw permissions —
 * this script only reads.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { priceInZar, type LunoBalance, type LunoBalanceSnapshot, type LunoTicker } from "../shared/luno";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "portfolio", "luno-balance.json");

interface LunoBalanceApi {
  balance: Array<{ account_id: string; asset: string; balance: string; reserved: string; unconfirmed: string }>;
}

async function main(): Promise<void> {
  // Load dashboard/.env if present, so this works in any shell (PowerShell has no `source`).
  // Variables already set in the environment win.
  try {
    process.loadEnvFile(path.join(__dirname, "..", ".env"));
  } catch {
    // No .env file — fall back to whatever is already in the environment.
  }

  const keyId = process.env.LUNO_API_KEY_ID;
  const keySecret = process.env.LUNO_API_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error(
      "Missing LUNO_API_KEY_ID / LUNO_API_KEY_SECRET.\n" +
      "Create a read-only API key at https://www.luno.com/wallet/security/api_keys (permission: Perm_R_Balance only),\n" +
      "then put them in dashboard/.env (see .env.example) — the script loads that file automatically.",
    );
    process.exitCode = 1;
    return;
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const [balanceRes, tickerRes] = await Promise.all([
    fetch("https://api.luno.com/api/1/balance", {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(15_000),
    }),
    fetch("https://api.luno.com/api/1/tickers", { signal: AbortSignal.timeout(15_000) }),
  ]);

  if (!balanceRes.ok) {
    throw new Error(`Luno balance request failed: HTTP ${balanceRes.status}. Check the API key and its permissions.`);
  }
  if (!tickerRes.ok) throw new Error(`Luno ticker request failed: HTTP ${tickerRes.status}`);

  const balanceBody = (await balanceRes.json()) as LunoBalanceApi;
  const tickerBody = (await tickerRes.json()) as { tickers?: LunoTicker[] };
  const tickers = tickerBody.tickers ?? [];

  const balances: LunoBalance[] = balanceBody.balance
    .map((b) => ({ asset: b.asset, balance: Number(b.balance), reserved: Number(b.reserved) }))
    .filter((b) => b.balance + b.reserved > 1e-9);

  const snapshot: LunoBalanceSnapshot = { asOf: new Date().toISOString(), balances };

  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(`Wrote ${OUT_PATH}`);
  for (const b of balances) {
    const zar = priceInZar(b.asset, b.balance + b.reserved, tickers);
    console.log(`  ${b.asset}: ${b.balance + b.reserved}${zar !== null ? ` (~R${zar.toFixed(2)})` : ""}`);
  }
  console.log("\nNow: git add public/portfolio/luno-balance.json && git commit && git push");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
