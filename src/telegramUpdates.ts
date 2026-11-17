import { errMsg, log } from "./log";

/** A button press, reduced to the few fields we use. */
export interface ButtonPress {
  updateId: number;
  callbackId: string;
  chatId: string;
  messageId: number;
  messageText: string;
  data: string;
}

/**
 * Pure parser for Telegram's getUpdates response (unit-tested). Anything that isn't a well-formed
 * button press is dropped; the caller still advances past it using `lastUpdateId`.
 */
export function parseUpdates(json: unknown): { presses: ButtonPress[]; lastUpdateId: number | null } {
  const result = (json as { ok?: boolean; result?: unknown })?.result;
  if (!Array.isArray(result)) return { presses: [], lastUpdateId: null };
  const presses: ButtonPress[] = [];
  let last: number | null = null;
  for (const u of result as Array<Record<string, any>>) {
    if (typeof u?.update_id !== "number") continue;
    last = last === null ? u.update_id : Math.max(last, u.update_id);
    const cq = u.callback_query;
    if (
      typeof cq?.id === "string" &&
      typeof cq.data === "string" &&
      typeof cq.message?.message_id === "number" &&
      cq.message.chat?.id !== undefined
    ) {
      presses.push({
        updateId: u.update_id,
        callbackId: cq.id,
        chatId: String(cq.message.chat.id),
        messageId: cq.message.message_id,
        messageText: typeof cq.message.text === "string" ? cq.message.text : "",
        data: cq.data,
      });
    }
  }
  return { presses, lastUpdateId: last };
}

/** Callback payloads we send look like "pb:<id>:d" (done) or "pb:<id>:s" (skip). */
export function parseCallbackData(data: string): { id: string; decision: "done" | "skipped" } | null {
  const m = /^pb:([0-9a-f]{10}):([ds])$/.exec(data);
  return m ? { id: m[1]!, decision: m[2] === "d" ? "done" : "skipped" } : null;
}

export const buttonData = (id: string, decision: "done" | "skipped"): string => `pb:${id}:${decision === "done" ? "d" : "s"}`;

async function call(token: string, method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Telegram ${method} responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/**
 * Button presses since `offset`. Uses getUpdates (we poll; no public web address is needed), which
 * Telegram refuses while a webhook is set on the bot: that error is returned as-is so it's visible.
 */
export async function fetchPresses(token: string, offset: number): Promise<{ presses: ButtonPress[]; lastUpdateId: number | null }> {
  return parseUpdates(await call(token, "getUpdates", { offset, timeout: 0, allowed_updates: ["callback_query"] }));
}

/** Removes the buttons and appends the outcome to the message. Best effort: the decision is already saved. */
export async function markMessage(token: string, press: ButtonPress, outcome: string): Promise<void> {
  try {
    await call(token, "editMessageText", {
      chat_id: press.chatId,
      message_id: press.messageId,
      text: `${press.messageText}\n\n${outcome}`.slice(0, 4000),
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [] },
    });
  } catch (e) {
    log.warn("could not update the Telegram message", { error: errMsg(e) });
  }
  try {
    await call(token, "answerCallbackQuery", { callback_query_id: press.callbackId });
  } catch {
    /* too old to answer (we poll, so this is normal): the edit above already shows the outcome */
  }
}
