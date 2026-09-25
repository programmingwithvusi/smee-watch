import type { SeriesPoint } from "./types";

/** A-share premium over the H-share, in percent. Positive = Shanghai shares trade richer. */
export function premiumPct(aPriceCny: number, hPriceHkd: number, hkdPerCny: number): number {
  if (!(hPriceHkd > 0)) throw new Error("H-share price must be positive");
  return ((aPriceCny * hkdPerCny) / hPriceHkd - 1) * 100;
}

const dayKey = (t: number): string => new Date(t * 1000).toISOString().slice(0, 10);

/**
 * Premium per day for the days both listings traded. The FX rate used is the latest one on or
 * before that day, so FX bars stamped at a different hour can't break the join.
 * All inputs must be sorted oldest first.
 */
export function premiumSeries(a: SeriesPoint[], h: SeriesPoint[], fx: SeriesPoint[]): SeriesPoint[] {
  const hByDay = new Map(h.map((p) => [dayKey(p.t), p.c]));
  const out: SeriesPoint[] = [];
  let fxIdx = -1;
  for (const pa of a) {
    const day = dayKey(pa.t);
    const hc = hByDay.get(day);
    if (hc === undefined || !(hc > 0)) continue;
    while (fxIdx + 1 < fx.length && dayKey(fx[fxIdx + 1]!.t) <= day) fxIdx += 1;
    const rate = fx[fxIdx]?.c;
    if (rate === undefined || !(rate > 0)) continue;
    out.push({ t: pa.t, c: premiumPct(pa.c, hc, rate) });
  }
  return out;
}
