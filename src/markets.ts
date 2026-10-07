import { FX_SYMBOL, SMIC_A, SMIC_H, WATCH_ETFS, WATCH_IDEAS, WATCHLIST } from "./config";
import { checkVolatility } from "./volatility";
import { errMsg, log } from "./log";
import { notify } from "./notify";
import { fetchQuote, fmtPct, fmtPrice, premiumPct, type Quote } from "./quotes";
import { openState } from "./state";

async function main(): Promise<void> {
  const digest = process.argv.includes("--digest");
  const dryRun = process.env.DRY_RUN === "1";
  const { state, save } = await openState("markets");
  const now = Date.now();
  let deliveryFailed = false;

  const all = [...WATCHLIST, ...WATCH_IDEAS, ...WATCH_ETFS];
  const settled = await Promise.allSettled(all.map((w) => fetchQuote(w.symbol)));
  const quotes = new Map<string, Quote>();
  settled.forEach((r, i) => {
    const w = all[i];
    if (!w) return;
    if (r.status === "fulfilled") {
      quotes.set(w.symbol, r.value);
      delete state.failures[w.symbol];
    } else {
      state.failures[w.symbol] = (state.failures[w.symbol] ?? 0) + 1;
      log.warn("quote failed", { symbol: w.symbol, error: errMsg(r.reason) });
    }
  });

  if (digest) {
    const line = (w: (typeof all)[number]) => {
      const q = quotes.get(w.symbol);
      return q ? `${w.label}: ${fmtPrice(q.price)} ${q.currency} (${fmtPct(q.changePct)})` : `${w.label}: unavailable`;
    };
    const lines = WATCHLIST.map(line);
    const a = quotes.get(SMIC_A);
    const h = quotes.get(SMIC_H);
    if (a && h) {
      try {
        const fx = await fetchQuote(FX_SYMBOL);
        lines.push(`SMIC A/H premium: ${fmtPct(premiumPct(a.price, h.price, fx.price))} (last prices, sessions differ)`);
      } catch (e) {
        log.warn("fx quote failed; skipping premium", { error: errMsg(e) });
      }
    }
    if (WATCH_IDEAS.length > 0) lines.push("", "👀 Watchlist", ...WATCH_IDEAS.map(line));
    if (WATCH_ETFS.length > 0) lines.push("", "🇿🇦 Rand ETFs", ...WATCH_ETFS.map(line));
    try {
      await notify(["📊 Chip digest", ...lines].join("\n"));
    } catch (e) {
      deliveryFailed = true;
      log.error("digest not delivered", { error: errMsg(e) });
    }
  } else {
    for (const w of all) {
      const q = quotes.get(w.symbol);
      if (!q) continue;

      const tier = Math.floor(Math.abs(q.changePct) / w.moveAlertPct);
      if (tier >= 1) {
        const key = `${w.symbol}:${q.day}:${q.changePct > 0 ? "up" : "down"}:${tier}`;
        if (state.alerted[key] === undefined) {
          const arrow = q.changePct > 0 ? "📈" : "📉";
          try {
            await notify(`${arrow} ${w.label} ${fmtPct(q.changePct)} vs previous close\nNow ${fmtPrice(q.price)} ${q.currency} (prev ${fmtPrice(q.prevClose)})`);
            state.alerted[key] = now;
          } catch (e) {
            deliveryFailed = true;
            log.error("move alert not delivered; will retry next run", { key, error: errMsg(e) });
          }
        }
      }

      // Separate from the fixed threshold above: flags a move that's unusual for THIS symbol
      // even when it doesn't clear moveAlertPct, e.g. a quiet stock having a loud day.
      const vol = checkVolatility(q.closeHistory, q.changePct);
      if (vol.unusual) {
        const volKey = `vol:${w.symbol}:${q.day}`;
        if (state.alerted[volKey] === undefined) {
          try {
            await notify(
              `⚡ Unusual move: ${w.label} ${fmtPct(q.changePct)} today, vs its own recent average of ~${vol.avgAbsMovePct.toFixed(2)}%/day.\nNow ${fmtPrice(q.price)} ${q.currency}. Not a fixed threshold — this is relative to the symbol's own recent behaviour.`,
            );
            state.alerted[volKey] = now;
          } catch (e) {
            deliveryFailed = true;
            log.error("volatility alert not delivered; will retry next run", { key: volKey, error: errMsg(e) });
          }
        }
      }
    }
  }

  if (!dryRun) await save();
  log.info("markets run finished", { digest, quotes: quotes.size, failed: all.length - quotes.size });
  if (deliveryFailed || quotes.size === 0) process.exitCode = 1;
}

main().catch((e) => {
  log.error("markets run crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
