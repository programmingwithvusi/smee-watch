import { createHash, timingSafeEqual } from "node:crypto";

export type AccessResult = "ok" | "unauthorized" | "unconfigured";

const sha256 = (s: string): Buffer => createHash("sha256").update(s).digest();

/**
 * Gate for the private portfolio endpoint: the caller must send the access code as a Bearer token.
 *
 *  - No code configured -> "unconfigured" (fail closed), except under `netlify dev` so local work
 *    still runs without setup. A forgotten env var must never silently publish the data.
 *  - Comparison is constant-time (both sides hashed to equal length first), so response timing
 *    leaks nothing about how much of a guess was right.
 */
export function checkAccess(authorization: string | null, env: Record<string, string | undefined>): AccessResult {
  const expected = env.PORTFOLIO_ACCESS_CODE;
  if (!expected) return env.NETLIFY_DEV === "true" ? "ok" : "unconfigured";
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  if (!match?.[1]) return "unauthorized";
  return timingSafeEqual(sha256(match[1].trim()), sha256(expected)) ? "ok" : "unauthorized";
}
