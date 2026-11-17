import { appendFileSync } from "node:fs";
import { errMsg, log } from "./log";
import { loadPaperFile, type PaperEntry } from "./paperLog";
import { fetchQuote, fmtPct } from "./quotes";

/** One row per logged suggestion: what happened to the price after it, and what you did about it. */
export function formatPaperReport(entries: readonly PaperEntry[], now: Record<string, number | undefined>): string {
  if (entries.length === 0) return "No suggestions logged yet. Rows appear here after a profit-banking alert fires.";
  const lines = [
    "| Date | Symbol | Rung | Status | Price then | Price now | Since | Banking helped? |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const e of [...entries].sort((a, b) => b.ts - a.ts)) {
    const cur = now[e.symbol];
    const since = cur === undefined ? null : ((cur - e.price) / e.price) * 100;
    // Selling a slice helped if the price has since fallen below the sale price, and cost upside if it rose
    const verdict = since === null ? "-" : since < 0 ? "yes (price fell)" : since > 0 ? "no (price rose)" : "even";
    lines.push(
      `| ${new Date(e.ts).toISOString().slice(0, 10)} | ${e.symbol} | +${e.rung}% | ${e.status} | ${e.price.toFixed(2)} ${e.currency} | ${cur === undefined ? "-" : cur.toFixed(2)} | ${since === null ? "-" : fmtPct(since)} | ${verdict} |`,
    );
  }
  lines.push("", "Paper only: nothing here is a real trade. 'Status' is what you pressed on the Telegram alert (suggested = no answer yet).");
  return lines.join("\n");
}

async function main(): Promise<void> {
  const { file } = await loadPaperFile();
  const now: Record<string, number> = {};
  for (const symbol of new Set(file.entries.map((e) => e.symbol))) {
    try {
      now[symbol] = (await fetchQuote(symbol)).price;
    } catch (e) {
      log.warn("paper report: price unavailable", { symbol, error: errMsg(e) });
    }
  }
  const out = formatPaperReport(file.entries, now);
  console.log(out);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Paper-trade log\n\n${out}\n`);
}

if (process.argv[1]?.endsWith("paperReport.ts")) {
  main().catch((e) => {
    log.error("paper report crashed", { error: errMsg(e) });
    process.exitCode = 1;
  });
}
