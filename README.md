# smee-watch

Four pieces in one repo:

1. **SMEE listing watcher.** Alerts when Shanghai Micro Electronics Equipment (上海微电子, and its spin-off 芯上微装 / AMIES) shows up in listing-related news, or on the SSE IPO review page (and again whenever its status changes there).
2. **Chip tracker.** Alerts on large day moves in ASML (Nasdaq + Amsterdam) and SMIC (STAR A-share + HKEX H-share), a volatility-widening alert relative to each symbol's own recent behaviour, a catalyst news watch (export controls, sanctions, entity-list actions), an earnings-date reminder, and a weekday digest with the SMIC A/H premium.
3. **Dashboard** (`dashboard/`). A React page for ASML and SMIC prices, open/closed clocks, the SMIC Shanghai-vs-Hong Kong gap, and your own Luno/EasyEquities holdings, deployable to Netlify. It has its own README.
4. **Portfolio tracking** (inside the dashboard). Your Luno balances and EasyEquities trades, kept as JSON files committed to this repo — see [What "anticipate slides" actually means](#what-anticipate-slides-actually-means) and the dashboard README's "Your holdings" section for exactly what's needed on your end.

The watcher runs free on GitHub Actions. No server.

## Setup (about 10 minutes)

1. **Telegram bot:** message `@BotFather`, send `/newbot`, keep the token. Send your new bot any message, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id` from the JSON.
   (Prefer no Telegram? Install the ntfy app, subscribe to a long random topic name, and use `NTFY_TOPIC` instead.)
2. Push this folder to a new GitHub repo.
3. **Settings → Secrets and variables → Actions → Secrets:** add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (and/or `NTFY_TOPIC`).
4. **Actions tab:** run each workflow once via *Run workflow* (`news`, `pages`, `markets`, `catalysts`, `earnings`). Each first run sends a "✅ online" message where relevant. If it doesn't arrive, the run turns red on purpose, so a bad token is obvious.

Optional repo variables: `ALERT_ALL=1` (also push lower-confidence SMEE news), `LOG_LEVEL=debug`.

## Verify before you trust it

I built and tested the logic (classification, de-duplication, retry-on-failed-delivery, per-source baselining, market alerts) against mocked feeds, but my sandbox couldn't reach Google News, Yahoo, or sse.com.cn, so **these are unverified against the live services**:

- **The SSE page.** Run locally: `LOG_LEVEL=debug DRY_RUN=1 npm run watch:pages` (after `npx playwright install chromium`). It logs how much text rendered. The page is checked for the marker in `PAGES[].expectText` (default `科创板`); if that's wrong for the real page, the source reports as failing. Adjust it in `src/config.ts`. Chinese sites sometimes throttle datacenter IPs, so a GitHub runner may be blocked; if so you'll get a "sources failing" warning after 6 failed runs rather than silence.
- **Yahoo Finance.** It's an unofficial endpoint and can rate-limit shared runner IPs. If quotes fail, swap `fetchQuote` in `src/quotes.ts` for Twelve Data or Alpha Vantage; `parseChart` is the only Yahoo-specific part.
- **Add the CSRC tutoring-filing page** (辅导备案), the earliest official IPO signal, to `PAGES` once you've confirmed a URL that renders in a browser.

## How alerts behave

- **News:** entity match (SMEE names) **and** listing vocabulary (上市, IPO, 辅导, 借壳, 停牌, 科创板…) = 🚨 push. SMEE news without those words is recorded silently unless `ALERT_ALL=1`.
- **Exact matching on purpose:** 芯上微装 (SMEE's spin-off) is not 芯碁微装 (688630, an unrelated listed company). Acronyms are case-sensitive so "Smee" the Peter Pan character doesn't fire.
- **Pages:** any line naming SMEE, plus the 3 lines after it (status columns). A status change re-alerts.
- **First run** baselines existing articles silently, per source. A source that was down on day one is baselined when it first answers, not flooded later.
- **Nothing is marked "seen" until the push is delivered**, so a Telegram outage means a retry, not a lost alert.
- **Market alerts:** fire at the threshold and again at each multiple (e.g. 4% and 8% for SMIC), once per direction per trading day. Thresholds live in `src/config.ts`.
- **Volatility alerts:** separate from the fixed threshold — fires when a move is unusual *for that symbol*, even if it's under the threshold (a normally-quiet stock having a loud day). Compares today's move to its own trailing average; tuned by `VOLATILITY_*` in `src/config.ts`.
- **Catalyst news:** the `catalysts` workflow runs every 2 hours and pushes only when a headline names ASML or SMIC (or SMEE's Chinese names) **and** carries listing/trade-policy vocabulary — export controls, entity list, sanctions, tariffs. Queries live in `CATALYST_QUERIES` in `src/config.ts`.
- **Earnings reminders:** the `earnings` workflow runs daily and reminds at 7, 3, 1, and 0 days before each date in `EARNINGS` in `src/config.ts`. Dates are hand-maintained (I don't have a live earnings-calendar feed wired in) — update them each quarter, and `confirmed: false` means it's an estimate until the company sets the real date.
- **Silent-failure guards:** empty/blocked pages count as failures; 6 consecutive failures push a warning; the weekday digest is a heartbeat, so if it stops arriving, check the Actions tab.

## What "anticipate slides" actually means

I'm not a financial advisor and this can't predict a move before it happens — nothing that reads public price feeds and news honestly can. What it *can* do is shrink the gap between a move happening and you finding out about it, three ways:

1. **Faster, self-relative detection.** Prices are checked every 15 minutes (was 30) and, alongside the fixed % threshold you set per symbol, a volatility-widening check flags a move that's unusual for that specific symbol even if it doesn't clear the threshold.
2. **Catalyst news**, not just price. Export-control and sanctions headlines often move ASML/SMIC before the price fully reflects it — the `catalysts` watch is aimed at exactly that vocabulary, in English and Chinese.
3. **A known earnings calendar**, so a scheduled event doesn't catch you off guard, with reminders well before the date.

None of this is a signal to buy or sell — it's faster information, which is the only honest thing a public-data tool can offer.

## Your Luno and EasyEquities trades

Short version: your portfolio data lives as JSON **committed to this repo**, written by two scripts **you run locally** — nothing is uploaded to a third party, and no trading credentials are ever stored in this project.

- **Luno** (crypto) has a real, read-only-capable API. Create an API key scoped to `Perm_R_Balance` only, put it in `dashboard/.env` (gitignored, never committed), and run `npm run luno:snapshot` from `dashboard/`. It writes `dashboard/public/portfolio/luno-balance.json`, which you commit.
- **EasyEquities** has **no official API** — confirmed by checking, including the unofficial community scrapers, which broke when EasyEquities added MFA to login. Per your choice, this uses a **CSV import** instead: export your trade history from EasyEquities, run `npm run import:easyequities -- path/to/file.csv`, and commit the resulting `dashboard/public/portfolio/trades.json`. Re-running with the same or an overlapping export is safe — duplicate rows are skipped.

Full details, exact commands, and what the dashboard shows for each: **`dashboard/README.md` → "Your holdings"**.

## Cost and limits

- Public repo: Actions minutes are free. Nothing sensitive is stored (secrets stay in Actions secrets; `state/` holds hashes and timestamps). GitHub pauses scheduled workflows on public repos after 60 days without repo activity, so re-enable them in the Actions tab if alerts stop.
- Private repo: the free tier is 2,000 minutes/month and this schedule (~3,000) exceeds it. Loosen the crons: news hourly, pages every 4-6 hours, markets hourly.
- Scheduled runs can start several minutes late. This is "minutes-level", not tick-level.

## Local use

```bash
npm install
npm test && npm run typecheck
cp .env.example .env && set -a && source .env && set +a
npm run notify:test          # sends a test push
DRY_RUN=1 npm run watch:news # DRY_RUN logs instead of sending, and doesn't write state
npm run watch:catalysts      # catalyst news, same DRY_RUN support
npm run earnings:check       # earnings-date reminders
npm run markets:digest
```

## Layout

```
src/config.ts        queries, pages, watchlist, thresholds, catalyst queries, earnings dates (edit this)
src/classify.ts       entity + listing-signal matching       src/catalystClassify.ts  catalyst matching
src/news.ts            Google News RSS
src/pages.ts            Playwright page watcher
src/quotes.ts            Yahoo chart parsing, A/H premium, close history
src/volatility.ts         self-relative "unusual move" check   src/earnings.ts  earnings reminder logic
src/watch.ts     news/pages/catalysts runner   src/markets.ts  markets runner   src/earningsCheck.ts  earnings runner
state/           seen items and alert keys, committed back by the workflows
dashboard/       the React dashboard, its Netlify functions, and your portfolio data (separate package, see its README)
```

Not investment advice. STAR Market debuts can be very volatile.
