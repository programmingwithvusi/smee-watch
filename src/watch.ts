import { classify, type Level } from "./classify";
import { classifyCatalyst } from "./catalystClassify";
import { CATALYST_QUERIES, FAIL_ALERT_AFTER } from "./config";
import { errMsg, log } from "./log";
import { fetchNews } from "./news";
import { notify } from "./notify";
import { fetchPages } from "./pages";
import { openState } from "./state";
import type { Hit } from "./types";

type Mode = "news" | "pages" | "catalysts";

function parseMode(args: string[]): Mode {
  const flags = ["--news", "--pages", "--catalysts"].filter((f) => args.includes(f));
  if (flags.length !== 1) throw new Error("pass exactly one of --news, --pages or --catalysts");
  return flags[0]!.slice(2) as Mode;
}

function format(hit: Hit, level: Level, mode: Mode): string {
  const head =
    mode === "pages"
      ? `🚨 SMEE spotted on ${hit.source}`
      : mode === "catalysts"
        ? `⚡ Chip catalyst (${hit.source})`
        : level === "high"
          ? `🚨 SMEE listing signal (${hit.source})`
          : `📰 SMEE news (${hit.source})`;
  return [head, hit.title, hit.url].join("\n");
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const dryRun = process.env.DRY_RUN === "1";
  const alertAll = process.env.ALERT_ALL === "1";
  const now = Date.now();

  const { state, save } = await openState(mode);
  const firstRun = Object.keys(state.seeded).length === 0;
  log.info("run started", { mode, firstRun, dryRun, alertAll });

  const result = mode === "pages" ? await fetchPages() : await fetchNews(mode === "catalysts" ? CATALYST_QUERIES : undefined);

  // Source health: a watcher that silently stops seeing anything is worse than no watcher.
  const failing: string[] = [];
  for (const name of result.ok) delete state.failures[name];
  for (const [name, error] of Object.entries(result.errors)) {
    const n = (state.failures[name] ?? 0) + 1;
    state.failures[name] = n;
    if (n % FAIL_ALERT_AFTER === 0) failing.push(`• ${name} (${n} runs in a row): ${error}`);
  }

  let sent = 0;
  let baselined = 0;
  let deliveryFailed = false;

  for (const hit of result.hits) {
    if (state.seen[hit.id] !== undefined) continue;
    const level: Level = mode === "pages" ? "high" : mode === "catalysts" ? classifyCatalyst(hit.title) : classify(hit.title);
    if (level === "none") continue; // not relevant; don't clutter state

    if (mode !== "pages" && state.seeded[hit.source] === undefined) {
      state.seen[hit.id] = now; // first successful fetch of this query: baseline old articles silently
      baselined += 1;
      continue;
    }
    if (level !== "high" && !alertAll) {
      state.seen[hit.id] = now; // seen, but not worth a push
      continue;
    }
    try {
      await notify(format(hit, level, mode));
      state.seen[hit.id] = now; // only mark seen once delivered
      sent += 1;
    } catch (e) {
      deliveryFailed = true;
      log.error("alert not delivered; will retry next run", { id: hit.id, error: errMsg(e) });
    }
  }

  if (failing.length > 0) {
    try {
      await notify(`⚠️ smee-watch (${mode}): sources failing, so you may be missing news.\n${failing.join("\n")}`);
    } catch (e) {
      deliveryFailed = true;
      log.error("health warning not delivered", { error: errMsg(e) });
    }
  }

  // Mark sources as baselined only after they actually answered, so an outage on the very
  // first run can't cause the whole back-catalogue to be pushed to you later.
  for (const name of result.ok) state.seeded[name] ??= now;

  if (firstRun && result.ok.length > 0) {
    try {
      await notify(`✅ smee-watch (${mode}) is online. Baselined ${baselined} existing items.`);
    } catch (e) {
      deliveryFailed = true; // turns the run red so a bad token/chat id is noticed immediately
      log.error("online message not delivered; check notification secrets", { error: errMsg(e) });
    }
  }

  if (!dryRun) await save();
  log.info("run finished", {
    mode,
    fetched: result.hits.length,
    sent,
    baselined,
    sourcesOk: result.ok.length,
    sourcesFailed: Object.keys(result.errors).length,
  });
  if (deliveryFailed) process.exitCode = 1;
}

main().catch((e) => {
  log.error("run crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
