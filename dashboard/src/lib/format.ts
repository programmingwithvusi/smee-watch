const MINUS = "\u2212";

export function formatPrice(value: number, currency: string): string {
  // Up to four decimals under 1, so a A$0.025 penny stock doesn't read as A$0.03
  const small = Math.abs(value) < 1 && value !== 0;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: small ? 4 : 2,
    }).format(value);
  } catch {
    return small ? String(Number(value.toFixed(4))) : value.toFixed(2);
  }
}

/** Rounds before signing, so float noise like -0.000001 reads "0.00%", not "−0.00%". */
export function formatPct(n: number, digits = 2): string {
  const r = Number(n.toFixed(digits)) || 0;
  const body = Math.abs(r).toFixed(digits);
  if (r > 0) return `+${body}%`;
  if (r < 0) return `${MINUS}${body}%`;
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
