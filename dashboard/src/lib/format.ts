const MINUS = "\u2212";

export function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export function formatPct(n: number, digits = 2): string {
  const body = Math.abs(n).toFixed(digits);
  if (n > 0) return `+${body}%`;
  if (n < 0) return `${MINUS}${body}%`;
  return `${body}%`;
}

export type Direction = "up" | "down" | "flat";
export const direction = (n: number): Direction => (n > 0.005 ? "up" : n < -0.005 ? "down" : "flat");

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayTimeFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

export function formatClock(epochSeconds: number): string {
  return timeFmt.format(new Date(epochSeconds * 1000));
}

/** "today 17:30", "Fri 17:30", or "12 Sep" once it's more than a week old. Uses the viewer's time zone. */
export function formatLastTrade(epochSeconds: number, now: Date): string {
  const d = new Date(epochSeconds * 1000);
  const ageDays = (now.getTime() - d.getTime()) / 86_400_000;
  if (d.toDateString() === now.toDateString()) return `today ${timeFmt.format(d)}`;
  if (ageDays < 6) return dayTimeFmt.format(d);
  return dateFmt.format(d);
}
