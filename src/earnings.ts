import {
  EARNINGS,
  EARNINGS_REACTION_SYMBOLS,
  EARNINGS_REACTION_WINDOW_DAYS,
  EARNINGS_REMINDER_DAYS_BEFORE,
  type EarningsEvent,
} from "./config";

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

// ---------------------------------------------------------------------------------------------
// Post-earnings reaction: not just "the date arrived" but "the market actually moved on it".
// We don't have a reliable, free source for consensus-vs-actual EPS, so this checks the one thing
// we can verify ourselves: whether the relevant symbol moved more than its own usual threshold in
// the days right after reporting. That's a real signal worth reading the actual results for — not
// a verdict on whether it was a beat or a miss.
// ---------------------------------------------------------------------------------------------
export interface DueReaction {
  event: EarningsEvent;
  daysAfter: number; // 1..windowDays
}

/** Yahoo symbol(s) whose price reaction is worth checking once this company has reported. */
export function symbolsForCompany(company: EarningsEvent["company"]): string[] {
  return EARNINGS_REACTION_SYMBOLS[company];
}

/**
 * Events whose date was 1..windowDays ago. Pure and testable; earningsCheck.ts dedups per
 * event+symbol via state so a quiet day doesn't get re-notified, and a move gets flagged once.
 */
export function dueReactions(
  events: EarningsEvent[],
  today: Date,
  windowDays: number = EARNINGS_REACTION_WINDOW_DAYS,
): DueReaction[] {
  const due: DueReaction[] = [];
  for (const event of events) {
    const days = daysUntil(event, today);
    if (days < 0 && days >= -windowDays) due.push({ event, daysAfter: -days });
  }
  return due;
}

export function formatReaction(event: EarningsEvent, label: string, changePct: number): string {
  const arrow = changePct > 0 ? "📈" : "📉";
  const pct = `${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%`;
  return `${arrow} Post-earnings reaction: ${label} ${pct} after ${event.label} (${event.date}).\nA move this size is usually about the actual numbers vs. estimates -- worth reading the real results before acting on the price alone.\n${event.source}`;
}
