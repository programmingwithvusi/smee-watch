import type { ExchangeId } from "../../shared/types";

interface Exchange {
  name: string;
  tz: string;
  /** Regular trading windows as [start, end) minutes after local midnight, Monday to Friday. */
  windows: ReadonlyArray<readonly [number, number]>;
}

const h = (hh: number, mm = 0): number => hh * 60 + mm;

export const EXCHANGES: Record<ExchangeId, Exchange> = {
  NASDAQ: { name: "Nasdaq", tz: "America/New_York", windows: [[h(9, 30), h(16)]] },
  AMS: { name: "Euronext Amsterdam", tz: "Europe/Amsterdam", windows: [[h(9), h(17, 30)]] },
  SSE: {
    name: "STAR Market, Shanghai",
    tz: "Asia/Shanghai",
    windows: [
      [h(9, 30), h(11, 30)],
      [h(13), h(15)],
    ],
  },
  HKEX: {
    name: "Hong Kong Exchange",
    tz: "Asia/Hong_Kong",
    windows: [
      [h(9, 30), h(12)],
      [h(13), h(16)],
    ],
  },
};

const DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(tz, f);
  }
  return f;
}

interface Wall {
  y: number;
  m: number;
  d: number;
  /** 1 = Monday ... 7 = Sunday */
  dow: number;
  secOfDay: number;
}

/** The wall-clock date and time in an exchange's time zone at a given instant. */
function wall(tz: string, at: Date): Wall {
  const parts = formatterFor(tz).formatToParts(at);
  const num = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  return {
    y: num("year"),
    m: num("month"),
    d: num("day"),
    dow: DOW[weekday] ?? 1,
    secOfDay: num("hour") * 3600 + num("minute") * 60 + num("second"),
  };
}

/** How far the zone's wall clock is ahead of UTC at an instant, in ms. */
function offsetMs(tz: string, at: Date): number {
  const w = wall(tz, at);
  return Date.UTC(w.y, w.m - 1, w.d, 0, 0, w.secOfDay) - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The real instant (epoch ms) at which a zone's wall clock reads y-m-d and minuteOfDay.
 * Two passes make it right across daylight-saving changes, which is why a Friday-evening
 * countdown to Monday's open stays exact on the weekend the clocks move.
 */
function wallToInstant(tz: string, y: number, m: number, d: number, minuteOfDay: number): number {
  const naive = Date.UTC(y, m - 1, d, 0, minuteOfDay);
  const first = naive - offsetMs(tz, new Date(naive));
  return naive - offsetMs(tz, new Date(first));
}

const secondsUntil = (targetMs: number, now: Date): number => Math.max(0, Math.ceil((targetMs - now.getTime()) / 1000));

export interface MarketState {
  open: boolean;
  /** Seconds until the market next opens (when closed) or closes (when open). */
  secondsToChange: number;
}

/**
 * Scheduled-hours state only. There is no holiday calendar, so on an exchange holiday this
 * says "open" during normal hours and the countdown runs to a close that never had an open.
 * The UI shows "last trade" next to it for that reason.
 */
export function marketState(id: ExchangeId, now: Date): MarketState {
  const ex = EXCHANGES[id];
  const w = wall(ex.tz, now);

  if (w.dow <= 5) {
    for (const [start, end] of ex.windows) {
      if (w.secOfDay >= start * 60 && w.secOfDay < end * 60) {
        return { open: true, secondsToChange: secondsUntil(wallToInstant(ex.tz, w.y, w.m, w.d, end), now) };
      }
    }
  }

  for (let add = 0; add <= 8; add += 1) {
    const day = new Date(Date.UTC(w.y, w.m - 1, w.d + add));
    const dow = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    if (dow > 5) continue;
    for (const [start] of ex.windows) {
      const at = wallToInstant(ex.tz, day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), start);
      if (at > now.getTime()) return { open: false, secondsToChange: secondsUntil(at, now) };
    }
  }
  return { open: false, secondsToChange: 0 };
}

/** Coarse form for screen readers and text: "45m", "2h 10m", "2d 2h". */
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m}m`;
  const hours = Math.floor(m / 60);
  const rem = m % 60;
  if (hours < 24) return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${days}d` : `${days}d ${h}h`;
}

/** Ticking form: "06:00:00", or "2d 17:30:00" once it's more than a day away. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86_400);
  const pad = (n: number): string => String(n).padStart(2, "0");
  const hms = `${pad(Math.floor((s % 86_400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return days > 0 ? `${days}d ${hms}` : hms;
}
