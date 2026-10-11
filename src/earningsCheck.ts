import { EARNINGS, WATCH_IDEAS, WATCHLIST } from "./config";
import { dueReactions, dueReminders, formatReaction, formatReminder, symbolsForCompany } from "./earnings";
import { errMsg, log } from "./log";
import { notify } from "./notify";
import { fetchQuote } from "./quotes";
import { openState } from "./state";

const ALL_SYMBOLS = [...WATCHLIST, ...WATCH_IDEAS];

function labelFor(symbol: string): string {
  return ALL_SYMBOLS.find((w) => w.symbol === symbol)?.label ?? symbol;
}

/** Falls back to 3% for a symbol not in WATCHLIST/WATCH_IDEAS; shouldn't happen for the companies
 * EARNINGS currently tracks, but a future company added to one without the other shouldn't crash. */
function thresholdFor(symbol: string): number {
  return ALL_SYMBOLS.find((w) => w.symbol === symbol)?.moveAlertPct ?? 3;
}

async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN === "1";
  const { state, save } = await openState("earnings");
  const today = new Date();

  const due = dueReminders(EARNINGS, today);
  let sent = 0;
  let deliveryFailed = false;

  for (const reminder of due) {
    const key = `${reminder.event.id}:${reminder.daysBefore}`;
    if (state.alerted[key] !== undefined) continue; // already sent this specific reminder
    try {
      await notify(formatReminder(reminder));
      state.alerted[key] = Date.now();
      sent += 1;
    } catch (e) {
      deliveryFailed = true;
      log.error("earnings reminder not delivered; will retry next run", { key, error: errMsg(e) });
    }
  }

  // Post-earnings reaction: once results are out, check the actual price move against the symbol's
  // own usual threshold, instead of only reminding you the date arrived. Fires at most once per
  // event+symbol, the first day in the window the move clears that threshold.
  for (const { event } of dueReactions(EARNINGS, today)) {
    for (const symbol of symbolsForCompany(event.company)) {
      const key = `reaction:${event.id}:${symbol}`;
      if (state.alerted[key] !== undefined) continue;
      try {
        const q = await fetchQuote(symbol);
        if (Math.abs(q.changePct) >= thresholdFor(symbol)) {
          await notify(formatReaction(event, labelFor(symbol), q.changePct));
          state.alerted[key] = Date.now();
          sent += 1;
        }
      } catch (e) {
        log.warn("post-earnings reaction check failed; will retry next run", { key, error: errMsg(e) });
      }
    }
  }

  if (!dryRun) await save();
  log.info("earnings check finished", { due: due.length, sent });
  if (deliveryFailed) process.exitCode = 1;
}

main().catch((e) => {
  log.error("earnings check crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
