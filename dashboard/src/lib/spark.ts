export interface SparkGeometry {
  path: string;
  last: { x: number; y: number } | null;
}

/**
 * Builds an SVG polyline path for a series. Pure, so it is unit-tested.
 * A flat series is drawn as a centred straight line instead of dividing by zero.
 */
export function sparkGeometry(values: readonly number[], width: number, height: number, pad = 3): SparkGeometry {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return { path: "", last: null };
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const pts = clean.map((v, i) => ({
    x: pad + (i / (clean.length - 1)) * innerW,
    y: span === 0 ? height / 2 : pad + (1 - (v - min) / span) * innerH,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return { path, last: pts[pts.length - 1] ?? null };
}
