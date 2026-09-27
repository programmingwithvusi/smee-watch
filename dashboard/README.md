# Chip stack watch (dashboard)

A small React + Vite page that shows ASML (Nasdaq and Amsterdam) and SMIC (STAR Market and Hong Kong), each with a one-month sparkline, a live countdown to that exchange's next open or close, and the gap between SMIC's Shanghai and Hong Kong share prices drawn as a box-in-box overlay mark (the pattern fabs use to check that two layers line up).

One Netlify Function (`/api/quotes`) fetches Yahoo Finance server-side, so the browser never hits CORS problems and the page makes a single request per refresh. A second function, `/api/portfolio`, shows your own Luno and EasyEquities holdings — see [Your holdings](#your-holdings) below.

## Run it

```bash
cd dashboard
npm install
npm run dev:netlify     # Vite + the functions together, at http://localhost:8888
npm test                # 70 tests
npm run typecheck
```

`npm run dev` alone serves the page but not `/api/*`, so you'd see the error state.

**If `/api/quotes` returns 404 under `dev:netlify`:** the Netlify CLI resolves relative paths from the repo root when this folder sits inside a bigger repo, so it looked for `<repo>/netlify/functions` and found nothing. `netlify.toml` fixes this with `functions = "netlify/functions"` under `[dev]`. On startup you should see `Loaded function quotes` and `Loaded function health`; if you don't, that line is missing or the CLI isn't reading this `netlify.toml`.

## Deploy to Netlify

1. Push the repo to GitHub.
2. Netlify: **Add new site → Import from Git**, pick the repo, and set **Base directory** to `dashboard`. The build command, publish folder and functions folder come from `dashboard/netlify.toml`.
3. Optional environment variables: `ALLOWED_ORIGIN` (one exact origin, e.g. `http://localhost:5173`; unset means same-origin only, and `*` is ignored on purpose) and `LOG_LEVEL`.

Because the watcher's Actions commit `state/` files to the same repo, every commit would trigger a Netlify build. In **Site configuration → Build & deploy → Build settings → Ignore builder**, use `git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF .` (run from the `dashboard` base directory) so it only rebuilds when the dashboard changes. Check that your very first deploy still builds.

## Endpoints

| Path | What it does |
| --- | --- |
| `GET /api/quotes` | The four listings, one month of daily closes, and the SMIC A/H premium. Cached at the CDN for 30 s. Returns 502 (never cached) if every upstream call fails; partial failures return what worked plus an `errors` map. |
| `GET /api/portfolio` | Your own holdings — see below. |
| `GET /api/health` | `{ "status": "UP" }`. Add `?deep=1` to also test the Yahoo upstream (503 if it's down). Point an uptime monitor at the deep one. |

Logs are one JSON object per line with a per-request `correlationId`.

## Your holdings

The page also shows your own Luno and EasyEquities positions, in a section below the market watchlist. Neither service is queried live from the deployed site — there's no API key sitting on Netlify. Instead, **you run a script locally, it writes a small JSON file, and you commit that file to this repo.** The `/api/portfolio` function just reads whatever was last committed and adds a live price where it can.

### Luno (crypto)

Luno has an official, read-only API, so this is a live snapshot of your balances.

1. In Luno: **Settings → API Keys → Create API Key**, and tick **only** `Perm_R_Balance` and, for gain/loss on what you paid, `Perm_R_Transactions`. Both are read-only. Don't grant trade or withdraw permissions — the script never needs them.
2. Add two lines to the project's `.env` (or `dashboard/.env`; both are gitignored): `LUNO_API_KEY_ID=...` and `LUNO_API_KEY_SECRET=...`.
3. `npm run luno:snapshot` — the script loads `.env` itself, in any shell (PowerShell included).

This fetches your balances, values them in ZAR using Luno's public ticker, and writes `public/portfolio/luno-balance.json`. With `Perm_R_Transactions` it also replays your Luno statement to work out the average rand price you paid per coin, and writes **only that average** — no individual transactions, dates or amounts, since the file is public. Coins that arrived by transfer or a coin-for-coin swap get no average, rather than a wrong one. It prints what it found and reminds you to `git add`/`commit`/`push`. **The API key stays on your machine and is never written to any file that gets committed** — only the resulting numbers are. Re-run it whenever you want a fresher snapshot; each run overwrites the file, so the git history is your history of balances over time.

### EasyEquities (JSE/US shares)

EasyEquities has **no official API** — I checked, including the unofficial third-party scrapers people have built, and those recently broke when EasyEquities moved its login to OIDC + MFA. Building against an unofficial, undocumented login flow isn't something I'll do without your go-ahead, and per your choice this uses a CSV export instead, which needs no credentials at all.

1. In EasyEquities, export your trade/transaction history as a CSV (Transactions or Trade History → Export/Download).
2. `npm run import:easyequities -- path/to/your-export.csv --dry-run` to preview what it found without writing anything.
3. Drop `--dry-run` to actually merge it into `public/portfolio/trades.json`, then `git add`/`commit`/`push`.

Re-running on the same file, or a new export that overlaps an old one, is safe: each row gets an id from its own contents, so anything already on file is skipped, never duplicated.

**I haven't seen a real EasyEquities export**, so the importer's column-name matching (`scripts/import-easyequities.ts`, `HEADER_ALIASES`) is a best guess at common header spellings (`Contract Code`, `Action`, `Quantity`, `Price`, …). If it stops with "couldn't find a column for X", it prints every header it did find — add the real spelling to `HEADER_ALIASES` (or send me that header row) and it'll pick it up.

### What each side shows

- **Luno holdings:** quantity plus a live ZAR value from Luno's public ticker. There's no cost basis (Luno's balance API doesn't give trade history), so "avg cost" isn't shown for these.
- **EasyEquities holdings:** quantity and weighted-average cost from your imported trades. A live price is shown only when the symbol matches something already in the watchlist (ASML, SMIC); anything else shows cost basis with "no live price" — extending the live-price lookup to arbitrary JSE tickers would need a market-data source I haven't wired up.
- Sells reduce the position but this **does not track realised profit/loss** — it's a current-holdings view, not a full accounting one.

## How the numbers work

- **Change** is the latest price against the previous daily close.
- **Premium** is `A-share price × HKD-per-CNY ÷ H-share price − 1`. The chart uses days when both listings traded, with the latest FX close on or before each day.
- **Open/closed and the countdown** follow each exchange's regular hours (Nasdaq 09:30-16:00 ET; Amsterdam 09:00-17:30; STAR 09:30-11:30 and 13:00-15:00; HKEX 09:30-12:00 and 13:00-16:00), ticking every second as `hh:mm:ss`, or `2d hh:mm:ss` over a weekend. The target is computed as a real instant in the exchange's time zone, so it stays exact across daylight-saving changes (a test sweeps both the European and US clock changes and checks the state flips on the exact second the countdown reaches zero). There is **no holiday calendar**, so on an exchange holiday it will count down to a close that never had an open. The "last trade" time is shown beside it for that reason. Data can lag by up to 15 minutes.
- **Accessibility:** the ticking digits are hidden from screen readers so they don't chatter every second. A visually hidden sentence ("Open, closes in 5h 56m") carries the same information.

## Not verified live

I could not open this in a real browser or reach Yahoo from my sandbox. What I did verify: types, 51 unit tests (including the functions with a mocked upstream), a production build, and a server-rendered layout check at desktop and phone widths. Please check in a browser: the Archivo font loading (it falls back to Arial Narrow), the overlay box's one-time slide-in on first load, dark mode, and that Yahoo answers from Netlify's servers. If Yahoo blocks them, only `shared/yahoo.ts` and `chartUrl` need replacing with another provider.

## Layout

```
shared/            types, watchlist, Yahoo parsing, premium maths (used by the function and the page)
                    portfolio.ts (holdings maths), luno.ts (ticker pricing), tradeId.ts (import dedup)
netlify/functions/ quotes.ts, portfolio.ts, health.ts
scripts/           luno-snapshot.ts, import-easyequities.ts — run locally, write public/portfolio/*.json
public/portfolio/  trades.json, luno-balance.json — committed data the portfolio function reads
src/Dashboard.tsx  the whole page as a pure view (props in, markup out)
src/components/    ListingRow, Sparkline, OverlayTarget, PremiumPanel, MarketStatus, PortfolioPanel
src/lib/           sessions (exchange hours), format, spark geometry
test/              vitest, describe/test/expect
```
