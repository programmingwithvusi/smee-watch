import { MACRO_QUERIES } from "./config";
import { loadHeadlines, mergeHeadlines, saveHeadlines } from "./headlines";
import { errMsg, log } from "./log";
import { fetchNews } from "./news";

/** Collects and theme-tags broad market headlines. Silent: it only feeds the context in price alerts. */
async function main(): Promise<void> {
  const now = Date.now();
  const result = await fetchNews(MACRO_QUERIES);
  if (result.ok.length === 0) throw new Error("every macro news query failed");
  const before = await loadHeadlines();
  const after = mergeHeadlines(before, result.hits, now);
  if (process.env.DRY_RUN !== "1") await saveHeadlines(after);
  log.info("macro run finished", {
    fetched: result.hits.length,
    stored: after.length,
    added: after.length - before.length,
    sourcesFailed: Object.keys(result.errors).length,
  });
}

main().catch((e) => {
  log.error("macro run crashed", { error: errMsg(e) });
  process.exitCode = 1;
});
