/**
 * The portfolio access code lives only in this browser's localStorage: typed once per device,
 * never baked into the page or the repo. Every access is wrapped because storage can be blocked
 * (private windows, cleared site data); the page must still render, just asking each time.
 */
const KEY = "portfolio-access-code";

export function getAccessCode(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveAccessCode(code: string): void {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    /* storage blocked: the code just won't be remembered */
  }
}

export function clearAccessCode(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
