import { formatCountdown, formatDuration, type MarketState } from "../lib/sessions";

/** "● Open" / "○ Closed". A filled vs hollow dot means open/closed never depends on colour alone. */
export function MarketBadge({ state }: { state: MarketState }) {
  return (
    <p className={`badge ${state.open ? "badge--open" : "badge--closed"}`} aria-hidden="true">
      <span className="badge__dot" />
      {state.open ? "Open" : "Closed"}
    </p>
  );
}

/**
 * Live countdown to the next open or close. The ticking digits are hidden from assistive tech
 * (a screen reader would otherwise chatter every second); the sr-only sentence carries the same
 * information at minute precision and, with the badge hidden, is the one thing announced.
 */
export function MarketCountdown({ state }: { state: MarketState }) {
  const word = state.open ? "Open" : "Closed";
  const verb = state.open ? "closes in" : "opens in";
  return (
    <p className="countdown">
      <span className="countdown__label" aria-hidden="true">{verb}</span>
      <span className="countdown__digits" aria-hidden="true">{formatCountdown(state.secondsToChange)}</span>
      <span className="sr-only">{`${word}, ${verb} ${formatDuration(Math.round(state.secondsToChange / 60))}`}</span>
    </p>
  );
}
