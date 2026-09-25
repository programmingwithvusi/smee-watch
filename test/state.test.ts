import { describe, expect, test } from "vitest";
import { parseState, prune } from "../src/state";

describe("parseState", () => {
  test("accepts a valid file", () => {
    const s = parseState(JSON.stringify({ seen: { a: 1 }, alerted: {}, failures: { q: 2 }, seeded: { q: 5 } }));
    expect(s.seen).toEqual({ a: 1 });
    expect(s.failures).toEqual({ q: 2 });
    expect(s.seeded).toEqual({ q: 5 });
  });

  test("ignores malformed or legacy fields instead of trusting them", () => {
    const s = parseState(JSON.stringify({ seen: "nope", seeded: true, failures: { q: "x" } }));
    expect(s.seen).toEqual({});
    expect(s.seeded).toEqual({});
    expect(s.failures).toEqual({});
  });

  test("rejects non-object JSON", () => {
    expect(() => parseState("42")).toThrow();
  });
});

describe("prune", () => {
  test("drops entries older than the retention window and keeps recent ones", () => {
    const now = Date.now();
    const old = now - 200 * 24 * 60 * 60 * 1000;
    const state = { seen: { old, fresh: now }, alerted: { old }, failures: {}, seeded: {} };
    prune(state, now);
    expect(Object.keys(state.seen)).toEqual(["fresh"]);
    expect(state.alerted).toEqual({});
  });
});
