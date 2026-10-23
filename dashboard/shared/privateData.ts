/**
 * Where the portfolio's raw numbers (holdings, cost basis, trades, Luno balances) are read from.
 *
 *  - Production: a PRIVATE GitHub repo (PORTFOLIO_DATA_REPO="owner/name") read through the GitHub
 *    contents API with a read-only token (PORTFOLIO_DATA_TOKEN). The numbers never sit in this
 *    public repo or in a publicly served file.
 *  - Local dev (no PORTFOLIO_DATA_REPO): the old same-origin /portfolio/<file> path, so a gitignored
 *    dashboard/public/portfolio/ folder keeps working under `npm run dev:netlify`.
 *
 * A missing file (404) is an empty result, not an error, matching the previous behaviour.
 */
export interface DataEnv {
  PORTFOLIO_DATA_REPO?: string;
  PORTFOLIO_DATA_TOKEN?: string;
  PORTFOLIO_DATA_REF?: string;
  PORTFOLIO_DATA_DIR?: string;
}

const SAFE_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_NAME = /^[A-Za-z0-9_.-]+\.json$/;

export function dataFileUrl(name: string, origin: string, env: DataEnv): { url: string; headers: Record<string, string> } {
  if (!SAFE_NAME.test(name)) throw new Error(`unsafe data file name: ${name}`);
  const repo = env.PORTFOLIO_DATA_REPO;
  if (!repo) return { url: `${origin}/portfolio/${name}`, headers: {} };
  if (!SAFE_REPO.test(repo)) throw new Error("PORTFOLIO_DATA_REPO must look like owner/name");
  const dir = (env.PORTFOLIO_DATA_DIR ?? "portfolio").replace(/^\/+|\/+$/g, "");
  const ref = env.PORTFOLIO_DATA_REF ? `?ref=${encodeURIComponent(env.PORTFOLIO_DATA_REF)}` : "";
  const headers: Record<string, string> = { Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (env.PORTFOLIO_DATA_TOKEN) headers.Authorization = `Bearer ${env.PORTFOLIO_DATA_TOKEN}`;
  return { url: `https://api.github.com/repos/${repo}/contents/${dir}/${name}${ref}`, headers };
}

export async function loadDataFile<T>(name: string, fallback: T, origin: string, env: DataEnv): Promise<T> {
  const { url, headers } = dataFileUrl(name, origin, env);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
  if (res.status === 404) return fallback;
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
