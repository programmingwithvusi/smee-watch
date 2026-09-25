import { errMsg, log } from "./log";

const TELEGRAM_LIMIT = 4000; // API cap is 4096 chars

async function postOk(url: string, init: RequestInit, what: string): Promise<void> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`${what} responded ${res.status}: ${body}`);
  }
}

async function telegram(token: string, chatId: string, text: string): Promise<void> {
  await postOk(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, TELEGRAM_LIMIT),
        disable_web_page_preview: true,
      }),
    },
    "Telegram",
  );
}

async function ntfy(topic: string, text: string): Promise<void> {
  const server = process.env.NTFY_SERVER ?? "https://ntfy.sh";
  await postOk(
    `${server}/${encodeURIComponent(topic)}`,
    { method: "POST", headers: { Title: "SMEE watch", Priority: "high" }, body: text },
    "ntfy",
  );
}

/**
 * Sends to every configured channel. Resolves if at least one succeeds; throws if all fail,
 * so callers can leave the item unseen and retry next run instead of silently losing an alert.
 * With no channel configured it throws, unless DRY_RUN=1 (then it only logs the message).
 */
export async function notify(text: string): Promise<void> {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId, NTFY_TOPIC: topic } = process.env;
  const sends: Array<{ channel: string; run: Promise<void> }> = [];
  if (token && chatId) sends.push({ channel: "telegram", run: telegram(token, chatId, text) });
  if (topic) sends.push({ channel: "ntfy", run: ntfy(topic, text) });

  if (sends.length === 0) {
    if (process.env.DRY_RUN === "1") {
      log.info("dry run: would have sent notification", { text });
      return;
    }
    // Fail loudly: a missing secret must never look like "nothing happened".
    throw new Error("no notification channel configured (set TELEGRAM_* or NTFY_TOPIC)");
  }

  const results = await Promise.allSettled(sends.map((s) => s.run));
  let delivered = 0;
  results.forEach((r, i) => {
    const channel = sends[i]?.channel ?? "unknown";
    if (r.status === "fulfilled") delivered += 1;
    else log.error("notification channel failed", { channel, error: errMsg(r.reason) });
  });
  if (delivered === 0) throw new Error("all notification channels failed");
}
