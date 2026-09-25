import { EARNINGS, EARNINGS_REMINDER_DAYS_BEFORE, type EarningsEvent } from "./config";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from `today` (UTC midnight) to the event's date. Negative once it's past. */
export function daysUntil(event: EarningsEvent, today: Date): number {
  const eventMs = Date.parse(`${event.date}T00:00:00Z`);
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((eventMs - todayMs) / DAY_MS);
}

export interface DueReminder {
  event: EarningsEvent;
  daysBefore: number;
}

/**
 * Which reminders are due today. Pure so it's testable without mocking the clock;
 * dedup against already-sent reminders happens in earningsCheck.ts via state.
 */
export function dueReminders(events: EarningsEvent[], today: Date, offsets: readonly number[] = EARNINGS_REMINDER_DAYS_BEFORE): DueReminder[] {
  const due: DueReminder[] = [];
  for (const event of events) {
    const days = daysUntil(event, today);
    if (offsets.includes(days)) due.push({ event, daysBefore: days });
  }
  return due;
}

export function formatReminder({ event, daysBefore }: DueReminder): string {
  const when = daysBefore === 0 ? "today" : daysBefore === 1 ? "tomorrow" : `in ${daysBefore} days`;
  const confidence = event.confirmed ? "" : " (estimated date, not yet officially confirmed — check closer to the time)";
  return `📅 ${event.label} is due ${when} (${event.date}).${confidence}\nHistorically the highest-probability window for a large move.\n${event.source}`;
}
