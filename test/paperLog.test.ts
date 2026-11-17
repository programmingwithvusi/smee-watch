import { describe, expect, test } from "vitest";
import { addEntry, decide, paperId, parsePaperFile, type PaperEntry, type PaperFile } from "../src/paperLog";
import { formatPaperReport } from "../src/paperReport";
import { buildTelegramBody } from "../src/notify";
import { buttonData, parseCallbackData, parseUpdates } from "../src/telegramUpdates";
import { parseCloses } from "../src/quotes";

const entry = (over: Partial<PaperEntry> = {}): PaperEntry => ({
  id: paperId("ANG.JO", 30),
  ts: Date.UTC(2026, 10, 17),
  symbol: "ANG.JO",
  track: "core",
  rung: 30,
  price: 1900,
  currency: "ZAR",
  slicePct: 25,
  status: "suggested",
  ...over,
});

describe("paper log", () => {
  test("ids are stable, short, and fit a Telegram callback payload", () => {
    expect(paperId("ANG.JO", 30)).toBe(paperId("ANG.JO", 30));
    expect(paperId("ANG.JO", 30)).not.toBe(paperId("ANG.JO", 60));
    expect(paperId("ANG.JO", 30)).toMatch(/^[0-9a-f]{10}$/);
    expect(Buffer.byteLength(buttonData(paperId("ANG.JO", 30), "skipped"))).toBeLessThanOrEqual(64);
  });

  test("a rung is logged once", () => {
    const file: PaperFile = { entries: [], telegramOffset: 0 };
    expect(addEntry(file, entry())).toBe(true);
    expect(addEntry(file, entry())).toBe(false);
    expect(file.entries).toHaveLength(1);
  });

  test("the first decision sticks; later presses leave it alone", () => {
    const file: PaperFile = { entries: [entry()], telegramOffset: 0 };
    expect(decide(file, entry().id, "done", 1000)?.status).toBe("done");
    expect(decide(file, entry().id, "skipped", 2000)?.status).toBe("done");
    expect(file.entries[0]?.decidedAt).toBe(1000);
    expect(decide(file, "nonexistent0", "done", 1)).toBeNull();
  });

  test("parsePaperFile drops malformed entries and defaults the offset", () => {
    const raw = JSON.stringify({ entries: [entry(), { id: 1 }, { ...entry(), status: "bogus" }] });
    const f = parsePaperFile(raw);
    expect(f.entries).toHaveLength(1);
    expect(f.telegramOffset).toBe(0);
  });

  test("stores no quantity, cost basis or P&L fields", () => {
    expect(Object.keys(entry()).sort()).toEqual(["currency", "id", "price", "rung", "slicePct", "status", "symbol", "track", "ts"]);
  });
});

describe("paper report", () => {
  test("says when empty, and judges banking by what the price did after", () => {
    expect(formatPaperReport([], {})).toContain("No suggestions");
    const down = formatPaperReport([entry()], { "ANG.JO": 1700 });
    expect(down).toContain("yes (price fell)");
    const up = formatPaperReport([entry()], { "ANG.JO": 2100 });
    expect(up).toContain("no (price rose)");
    expect(formatPaperReport([entry()], {})).toContain("| - | - | - |");
  });
});

describe("telegram buttons", () => {
  test("adds an inline keyboard only when buttons are given", () => {
    expect(buildTelegramBody("1", "hi")).not.toHaveProperty("reply_markup");
    const body = buildTelegramBody("1", "hi", { buttons: [[{ text: "Yes", data: "pb:aaaaaaaaaa:d" }]] });
    expect(body.reply_markup).toEqual({ inline_keyboard: [[{ text: "Yes", callback_data: "pb:aaaaaaaaaa:d" }]] });
  });

  test("parses only well-formed callback payloads", () => {
    expect(parseCallbackData("pb:0123456789:d")).toEqual({ id: "0123456789", decision: "done" });
    expect(parseCallbackData("pb:0123456789:s")).toEqual({ id: "0123456789", decision: "skipped" });
    for (const bad of ["", "pb:short:d", "pb:0123456789:x", "xx:0123456789:d", "pb:0123456789:d; drop"]) {
      expect(parseCallbackData(bad)).toBeNull();
    }
  });

  test("parseUpdates keeps button presses, drops everything else, and tracks the last update id", () => {
    const json = {
      ok: true,
      result: [
        { update_id: 7, callback_query: { id: "cb1", data: "pb:0123456789:d", message: { message_id: 5, text: "alert", chat: { id: 42 } } } },
        { update_id: 9, message: { text: "hello" } },
        { update_id: 8, callback_query: { id: "cb2" } },
      ],
    };
    const { presses, lastUpdateId } = parseUpdates(json);
    expect(lastUpdateId).toBe(9);
    expect(presses).toEqual([
      { updateId: 7, callbackId: "cb1", chatId: "42", messageId: 5, messageText: "alert", data: "pb:0123456789:d" },
    ]);
    expect(parseUpdates({ ok: false })).toEqual({ presses: [], lastUpdateId: null });
  });
});

describe("parseCloses", () => {
  test("drops nulls and converts JSE cents to rand", () => {
    const json = { chart: { result: [{ meta: { currency: "ZAc" }, indicators: { quote: [{ close: [100, null, 250, 0] }] } }] } };
    expect(parseCloses(json)).toEqual([1, 2.5]);
  });
  test("throws on an empty result", () => {
    expect(() => parseCloses({ chart: { result: null, error: { description: "nope" } } })).toThrow("nope");
  });
});
