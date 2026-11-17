import { BANK_SLICE_PCT, POSITIONS } from "./config";
import { errMsg, log } from "./log";
import { notify } from "./notify";
import { addEntry, loadPaperFile, paperId } from "./paperLog";
import { fetchQuote } from "./quotes";
import { formatBankAlert, pnlPct, rungsReached } from "./profitBanking";
import { openState } from "./state";
import { buttonData } from "./telegramUpdates";

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "1";
  const { state, save } = await openState("profitBanking");
  const paper = await loadPaperFile();
  // Approve/Skip buttons stay off until you've switched them on (see the README), so alerts are unchanged by default
  const buttons = process.env.TELEGRAM_BUTTONS === "1";
  let sent = 0;
  let deliveryFailed = false;
  if (POSITIONS.length === 0) {
    log.warn("no positions to check: set the POSITIONS_JSON secret (see src/config.ts)");
  }

  for (const position of POSITIONS) {
    try {
      const q = await fetchQuote(position.symbol);
      const pnl = pnlPct(q.price, position.costPerUnit);

      for (const rung of rungsReached(position, pnl)) {
        const key = `bank:${position.symbol}:+${rung}%`;
        if (state.alerted[key] !== undefined) continue;
        try {
          const id = paperId(position.symbol, rung);
          await notify(
            formatBankAlert(position, pnl, rung, q.price, q.currency),
            buttons
              ? {
                  buttons: [
                    [
                      { text: "✅ I did it", data: buttonData(id, "done") },
                      { text: "⏭ Skip", data: buttonData(id, "skipped") },
                    ],
                  ],
                }
              : {},
          );
          state.alerted[key] = Date.now();
          // Log what the rule suggested (market price only: never your cost basis or P&L, the file is public)
          addEntry(paper.file, {
            id,
            ts: Date.now(),
            symbol: position.symbol,
            track: position.track,
            rung,
            price: q.price,
            currency: q.currency,
            slicePct: BANK_SLICE_PCT,
            status: "suggested",
          });
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

  if (!dryRun) {
    await save();
    await paper.save();
  }
  log.info("profit-banking check finished", { positions: POSITIONS.length, sent });
  if (deliveryFailed) process.exitCode = 1;
}

main().catch((e) => {
  log.error("profit-banking check crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
