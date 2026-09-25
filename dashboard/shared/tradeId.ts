import { createHash } from "node:crypto";
import type { Trade } from "./portfolio";

/**
 * Deterministic id for a trade from its own content, so importing the same CSV row twice (or the
 * same file twice) collapses to one entry instead of double-counting. Node-only (uses crypto) —
 * imported by the import script, never by the browser bundle.
 */
export function tradeId(t: Omit<Trade, "id">): string {
  const key = [t.source, t.date, t.symbol, t.side, t.quantity, t.price, t.currency].join("|");
  return createHash("sha1").update(key).digest("hex").slice(0, 16);
}
