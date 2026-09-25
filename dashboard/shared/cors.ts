/**
 * Explicit CORS policy. The app and API share an origin on Netlify, so by default NO cross-origin
 * access is granted. Set ALLOWED_ORIGIN (a single exact origin, never "*") to allow one other site,
 * e.g. a local dev server: ALLOWED_ORIGIN=http://localhost:5173
 */
export function corsHeaders(requestOrigin: string | null, allowedOrigin: string | undefined): Record<string, string> {
  const base = { Vary: "Origin" };
  if (!requestOrigin || !allowedOrigin || allowedOrigin === "*") return base;
  if (requestOrigin !== allowedOrigin) return base;
  return {
    ...base,
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
  };
}
