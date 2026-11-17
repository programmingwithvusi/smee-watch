import { appendFileSync } from "node:fs";
import { DEFAULT_BACKTEST_SYMBOLS } from "./config";
import { backtestSymbol, compareRules, formatBacktestTable, formatComparison, type BacktestSummary, type Track } from "./backtest";
import { errMsg, log } from "./log";
import { fetchCloses } from "./quotes";

/** Usage: npm run backtest -- [SYMBOL ...]   (no symbols = the defaults in config.ts) */
async function main(): Promise<void> {
  const args = process.argv.slice(2).flatMap((a) => a.split(/[,\s]+/)).filter(Boolean);
  const symbols = args.length ? args : DEFAULT_BACKTEST_SYMBOLS;
  const rows: BacktestSummary[] = [];
  const failed: string[] = [];
  const closesBySymbol: Record<string, number[]> = {};

  for (const symbol of symbols) {
    try {
      const closes = await fetchCloses(symbol, "5y");
      closesBySymbol[symbol] = closes;
      for (const track of ["core", "speculative"] as Track[]) rows.push(backtestSymbol(symbol, closes, track));
    } catch (e) {
      failed.push(symbol);
      log.warn("backtest skipped a symbol", { symbol, error: errMsg(e) });
    }
  }

  const out = [
    formatBacktestTable(rows),
    "\n## Rule variants\n",
    formatComparison(compareRules(closesBySymbol)),
    failed.length ? `\nCould not load: ${failed.join(", ")}` : "",
  ].join("\n");
  console.log(out);
  // On GitHub Actions this shows up on the run's summary page
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Banking-rule backtest\n\n${out}\n`);
  if (rows.length === 0) process.exitCode = 1;
}

main().catch((e) => {
  log.error("backtest crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
