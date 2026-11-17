import { errMsg, log } from "./log";
import { decide, loadPaperFile } from "./paperLog";
import { fetchPresses, markMessage, parseCallbackData } from "./telegramUpdates";

/**
 * Applies Approve/Skip button presses from Telegram to the paper log. Nothing is traded: "Done"
 * only records that you placed the trade yourself on your own platform.
 *
 * Only presses from your own chat count (TELEGRAM_CHAT_ID); anything else is ignored.
 */
async function main(): Promise<void> {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId } = process.env;
  if (!token || !chatId) {
    log.info("decisions skipped: Telegram is not configured");
    return;
  }
  const { file, save } = await loadPaperFile();
  const { presses, lastUpdateId } = await fetchPresses(token, file.telegramOffset);

  let applied = 0;
  for (const press of presses) {
    if (press.chatId !== chatId) {
      log.warn("ignored a button press from another chat");
      continue;
    }
    const parsed = parseCallbackData(press.data);
    if (!parsed) continue;
    const entry = decide(file, parsed.id, parsed.decision, Date.now());
    if (!entry) {
      await markMessage(token, press, "⚠️ I no longer have a record of this suggestion.");
      continue;
    }
    applied += 1;
    const said = entry.status === "done" ? "✅ Marked as done." : "⏭ Marked as skipped.";
    await markMessage(token, press, `${said} Paper log updated. Nothing was traded for you.`);
  }

  if (lastUpdateId !== null) file.telegramOffset = lastUpdateId + 1;
  if (process.env.DRY_RUN !== "1") await save();
  log.info("decisions processed", { presses: presses.length, applied });
}

main().catch((e) => {
  log.error("decisions run crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
