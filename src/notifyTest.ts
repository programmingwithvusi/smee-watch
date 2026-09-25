import { notify } from "./notify";
import { errMsg, log } from "./log";

try {
  await notify("✅ smee-watch: test notification. If you can read this, alerts will reach you.");
  log.info("test notification sent");
} catch (e) {
  log.error("test notification failed", { error: errMsg(e) });
  process.exitCode = 1;
}
