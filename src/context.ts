import { CONTEXT_SYMBOLS } from "./config";
import { errMsg, log } from "./log";
import { fetchQuote, fmtPct, type Quote } from "./quotes";

/** Formats one cross-asset reading. Yields are shown in basis-point change, not percent-of-a-percent. */
export function formatContextItem(label: string, kind: "price" | "yield" | "index", q: Quote): string {
  if (kind === "yield") {
    const bp = Math.round((q.price - q.prevClose) * 100);
    return `${label} ${q.price.toFixed(2)}% (${bp > 0 ? "+" : ""}${bp}bp)`;
  }
  const price = kind === "price" ? `$${q.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : q.price.toFixed(1);
  return `${label} ${price} (${fmtPct(q.changePct)})`;
}

/** Oil, the US 10-year yield, the VIX and Bitcoin on one line; skips any that failed to load. */
export async function contextLine(): Promise<string> {
  const settled = await Promise.allSettled(CONTEXT_SYMBOLS.map((c) => fetchQuote(c.symbol)));
  const parts: string[] = [];
  settled.forEach((r, i) => {
    const c = CONTEXT_SYMBOLS[i];
    if (!c) return;
    if (r.status === "fulfilled") parts.push(formatContextItem(c.label, c.kind, r.value));
    else log.warn("context quote failed", { symbol: c.symbol, error: errMsg(r.reason) });
  });
  return parts.length > 0 ? `🌐 ${parts.join(" · ")}` : "";
}
