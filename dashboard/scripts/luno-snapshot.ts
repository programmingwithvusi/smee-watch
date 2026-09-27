#!/usr/bin/env -S npx tsx
/**
 * Run this yourself, locally: `npm run luno:snapshot`.
 *
 * Fetches your Luno balances with a read-only API key and writes public/portfolio/luno-balance.json
 * — the file the dashboard (via the /api/portfolio function) reads to show your crypto holdings.
 * The API key never leaves your machine and is never committed: it's read from environment
 * variables in the project's .env or dashboard/.env (both gitignored), and only the resulting balance NUMBERS are written
 * to the JSON file you then `git add`/`git commit`/`git push` yourself.
 *
 * What you need on the Luno side: Settings → API Keys → Create API Key, with ONLY the
 * "Perm_R_Balance" (read balance) permission ticked, plus "Perm_R_Transactions" (read transactions)
 * if you want gain/loss on cost. Do not grant trade or withdraw permissions — this script only reads.
 *
 * With Perm_R_Transactions it replays your statement to work out what you paid per coin, and writes
 * ONLY that average (`avgCostZar`) — never the individual transactions, their dates or amounts —
 * because the file is committed to a public repo.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  lunoCostBasis,
  priceInZar,
  type LunoBalance,
  type LunoBalanceSnapshot,
  type LunoStatementEntry,
  type LunoTicker,
} from "../shared/luno";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "public", "portfolio", "luno-balance.json");

interface LunoBalanceApi {
  balance: Array<{ account_id: string; asset: string; balance: string; reserved: string; unconfirmed: string }>;
}

interface LunoTransactionsApi {
  transactions?: Array<{
    row_index: number;
    timestamp: number;
    balance_delta: string;
    currency: string;
    kind: string;
    reference?: string;
  }>;
}

const PAGE = 1000; // Luno's maximum rows per call

/** Every statement entry for one account, oldest first. Throws "forbidden" without Perm_R_Transactions. */
async function fetchStatement(accountId: string, auth: string): Promise<LunoStatementEntry[]> {
  const out: LunoStatementEntry[] = [];
  for (let min = 1; ; min += PAGE) {
    const url = `https://api.luno.com/api/1/accounts/${encodeURIComponent(accountId)}/transactions?min_row=${min}&max_row=${min + PAGE}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(15_000) });
    if (res.status === 401 || res.status === 403) throw new Error("forbidden");
    if (!res.ok) throw new Error(`Luno transactions request failed: HTTP ${res.status}`);
    const rows = ((await res.json()) as LunoTransactionsApi).transactions ?? [];
    for (const t of rows) {
      out.push({
        currency: t.currency,
        delta: Number(t.balance_delta),
        kind: t.kind,
        reference: t.reference ?? "",
        timestamp: t.timestamp,
        rowIndex: t.row_index,
      });
    }
    if (rows.length < PAGE) return out;
  }
}

async function main(): Promise<void> {
  // Load dashboard/.env, then the project root's .env, so this works in any shell (PowerShell has no
  // `source`). Neither overrides a variable that's already set, so the first file to set one wins.
  for (const file of [path.join(__dirname, "..", ".env"), path.join(__dirname, "..", "..", ".env")]) {
    try {
      process.loadEnvFile(file);
    } catch {
      // No such file — try the next, then fall back to whatever is already in the environment.
    }
  }

  const keyId = process.env.LUNO_API_KEY_ID;
  const keySecret = process.env.LUNO_API_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error(
      "Missing LUNO_API_KEY_ID / LUNO_API_KEY_SECRET.\n" +
      "Create a read-only API key at https://www.luno.com/wallet/security/api_keys (permissions: Perm_R_Balance, plus Perm_R_Transactions for gain/loss on cost),\n" +
      "then put them in the project's .env (or dashboard/.env) as LUNO_API_KEY_ID=... and LUNO_API_KEY_SECRET=... — the script loads it automatically.",
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

  // Cost basis from the statement of every account (ZAR included: it holds the rand side of each buy)
  let basis = new Map<string, number>();
  try {
    const statements = await Promise.all(balanceBody.balance.map((b) => fetchStatement(b.account_id, auth)));
    basis = lunoCostBasis(statements.flat());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      msg === "forbidden"
        ? "Note: this key can't read transactions, so no gain/loss on cost. Add the Perm_R_Transactions permission to enable it."
        : `Note: couldn't read transactions (${msg}), so no gain/loss on cost this time.`,
    );
  }

  const balances: LunoBalance[] = balanceBody.balance
    .map((b) => {
      const avg = basis.get(b.asset);
      return {
        asset: b.asset,
        balance: Number(b.balance),
        reserved: Number(b.reserved),
        ...(avg !== undefined && { avgCostZar: Math.round(avg * 100) / 100 }),
      };
    })
    .filter((b) => b.balance + b.reserved > 1e-9);

  const snapshot: LunoBalanceSnapshot = { asOf: new Date().toISOString(), balances };

  await writeFile(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(`Wrote ${OUT_PATH}`);
  for (const b of balances) {
    const qty = b.balance + b.reserved;
    const zar = priceInZar(b.asset, qty, tickers);
    const notes = [
      zar !== null && `~R${zar.toFixed(2)} now`,
      b.avgCostZar !== undefined && `paid ~R${(b.avgCostZar * qty).toFixed(2)}`,
    ].filter(Boolean);
    console.log(`  ${b.asset}: ${qty}${notes.length ? ` (${notes.join(", ")})` : ""}`);
  }
  console.log("\nNow: git add public/portfolio/luno-balance.json && git commit && git push");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
