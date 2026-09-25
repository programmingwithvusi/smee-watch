import { EARNINGS } from "./config";
import { dueReminders, formatReminder } from "./earnings";
import { errMsg, log } from "./log";
import { notify } from "./notify";
import { openState } from "./state";

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

  if (!dryRun) await save();
  log.info("earnings check finished", { due: due.length, sent });
  if (deliveryFailed) process.exitCode = 1;
}

main().catch((e) => {
  log.error("earnings check crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
