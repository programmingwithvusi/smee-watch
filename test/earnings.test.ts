import { describe, expect, test } from "vitest";
import type { EarningsEvent } from "../src/config";
import { daysUntil, dueReminders, formatReminder } from "../src/earnings";

const EVENT: EarningsEvent = {
  id: "test-co-q1",
  company: "ASML",
  label: "Test Co Q1 results",
  date: "2026-10-14",
  confirmed: true,
  source: "https://example.com",
};

describe("daysUntil", () => {
  test("counts whole calendar days, ignoring time of day", () => {
    expect(daysUntil(EVENT, new Date("2026-10-07T23:00:00Z"))).toBe(7);
    expect(daysUntil(EVENT, new Date("2026-10-14T00:00:01Z"))).toBe(0);
  });

  test("goes negative once the date has passed", () => {
    expect(daysUntil(EVENT, new Date("2026-10-16T00:00:00Z"))).toBe(-2);
  });
});

describe("dueReminders", () => {
  test("fires only on the configured offsets", () => {
    expect(dueReminders([EVENT], new Date("2026-10-07T00:00:00Z"), [7, 3, 1, 0])).toHaveLength(1);
    expect(dueReminders([EVENT], new Date("2026-10-08T00:00:00Z"), [7, 3, 1, 0])).toHaveLength(0);
    expect(dueReminders([EVENT], new Date("2026-10-14T00:00:00Z"), [7, 3, 1, 0])).toHaveLength(1);
  });

  test("multiple events on the same offset both fire", () => {
    const second: EarningsEvent = { ...EVENT, id: "test-co-2", date: "2026-10-14" };
    expect(dueReminders([EVENT, second], new Date("2026-10-11T00:00:00Z"), [3])).toHaveLength(2);
  });
});

describe("formatReminder", () => {
  test("says 'today' at zero days and marks unconfirmed dates", () => {
    const today = formatReminder({ event: EVENT, daysBefore: 0 });
    expect(today).toContain("due today");
    const unconfirmed = formatReminder({ event: { ...EVENT, confirmed: false }, daysBefore: 3 });
    expect(unconfirmed).toContain("estimated date");
    expect(unconfirmed).toContain("in 3 days");
  });
});
