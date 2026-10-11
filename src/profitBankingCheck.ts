import { POSITIONS } from "./config";
import { errMsg, log } from "./log";
import { notify } from "./notify";
import { fetchQuote } from "./quotes";
import { formatBankAlert, pnlPct, rungsReached } from "./profitBanking";
import { openState } from "./state";

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "1";
  const { state, save } = await openState("profitBanking");
  let sent = 0;
  let deliveryFailed = false;

  for (const position of POSITIONS) {
    try {
      const q = await fetchQuote(position.symbol);
      const pnl = pnlPct(q.price, position.costPerUnit);

      for (const rung of rungsReached(position, pnl)) {
        const key = `bank:${position.symbol}:+${rung}%`;
        if (state.alerted[key] !== undefined) continue;
        try {
          await notify(formatBankAlert(position, pnl, rung, q.price, q.currency));
          state.alerted[key] = Date.now();
          sent += 1;
        } catch (e) {
          deliveryFailed = true;
          log.error("bank alert not delivered; will retry next run", { key, error: errMsg(e) });
        }
      }
    } catch (e) {
      log.warn("profit-banking quote failed; will retry next run", { symbol: position.symbol, error: errMsg(e) });
    }
  }

  if (!dryRun) await save();
  log.info("profit-banking check finished", { positions: POSITIONS.length, sent });
  if (deliveryFailed) process.exitCode = 1;
}

main().catch((e) => {
  log.error("profit-banking check crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
