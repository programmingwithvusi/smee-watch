import { memo, useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Inner box travels at most this far, which is exactly where it touches the frame. */
const MAX_SHIFT = 36;
/** Premium (percent) at which the inner box reaches the frame */
const FULL_SCALE_PCT = 100;

export function overlayShift(premiumPct: number): number {
  const s = (premiumPct / FULL_SCALE_PCT) * MAX_SHIFT;
  return Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, s));
}

/**
 * A box-in-box overlay mark, the pattern fabs use to check that two layers line up.
 * Outer frame = the Hong Kong price (reference). Inner box = the Shanghai price.
 * The box sits dead centre at parity and drifts up-right as Shanghai gets pricier.
 */
export const OverlayTarget = memo(function OverlayTarget({ premiumPct }: { premiumPct: number }) {
  const shift = overlayShift(premiumPct);
  const reduced = useReducedMotion();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  // Slide in once on first paint only; later refreshes just move the box.
  const animateIn = !reduced && !mounted.current && shift !== 0;

  const above = premiumPct >= 0 ? "above" : "below";
  const label = `Overlay mark. Shanghai shares are ${Math.abs(premiumPct).toFixed(1)} percent ${above} Hong Kong shares.`;
  const ticks = [30, 50, 70, 90, 110, 130, 150, 170, 190];

  return (
    <svg className="overlay" viewBox="0 0 220 220" role="img" aria-label={label}>
      <g className="overlay__ticks">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={t} y1="6" x2={t} y2={t % 40 === 30 ? 16 : 12} />
            <line x1="6" y1={t} x2={t % 40 === 30 ? 16 : 12} y2={t} />
          </g>
        ))}
      </g>
      <line className="overlay__cross" x1="22" y1="110" x2="198" y2="110" />
      <line className="overlay__cross" x1="110" y1="22" x2="110" y2="198" />
      <rect className="overlay__frame" x="30" y="30" width="160" height="160" />
      <g transform={`translate(${shift.toFixed(2)} ${(-shift).toFixed(2)})`}>
        {animateIn && (
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to={`${shift.toFixed(2)} ${(-shift).toFixed(2)}`}
            dur="1s"
            begin="0.15s"
            fill="freeze"
            calcMode="spline"
            keyTimes="0;1"
            keySplines="0.2 0.8 0.2 1"
          />
        )}
        <rect className="overlay__inner" x="66" y="66" width="88" height="88" />
        <circle className="overlay__center" cx="110" cy="110" r="2.5" />
      </g>
    </svg>
  );
});
