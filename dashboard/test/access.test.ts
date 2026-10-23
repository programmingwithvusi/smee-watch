import { describe, expect, test } from "vitest";
import { checkAccess } from "../shared/access";
import { dataFileUrl } from "../shared/privateData";

describe("checkAccess", () => {
  const env = { PORTFOLIO_ACCESS_CODE: "s3cret-code" };
  test("accepts the right bearer token", () => expect(checkAccess("Bearer s3cret-code", env)).toBe("ok"));
  test("rejects missing, malformed and wrong tokens", () => {
    expect(checkAccess(null, env)).toBe("unauthorized");
    expect(checkAccess("s3cret-code", env)).toBe("unauthorized");
    expect(checkAccess("Bearer nope", env)).toBe("unauthorized");
    expect(checkAccess("Bearer s3cret-cod", env)).toBe("unauthorized");
    expect(checkAccess("Bearer ", env)).toBe("unauthorized");
  });
  test("with no code configured it fails closed, except under netlify dev", () => {
    expect(checkAccess(null, {})).toBe("unconfigured");
    expect(checkAccess("Bearer x", { PORTFOLIO_ACCESS_CODE: "" })).toBe("unconfigured");
    expect(checkAccess(null, { NETLIFY_DEV: "true" })).toBe("ok");
  });
});

describe("dataFileUrl", () => {
  test("falls back to the same-origin file when no private repo is set", () => {
    expect(dataFileUrl("trades.json", "https://site.test", {}).url).toBe("https://site.test/portfolio/trades.json");
  });
  test("builds a GitHub contents URL with the token and optional ref", () => {
    const r = dataFileUrl("trades.json", "https://site.test", { PORTFOLIO_DATA_REPO: "me/data", PORTFOLIO_DATA_TOKEN: "t", PORTFOLIO_DATA_REF: "main" });
    expect(r.url).toBe("https://api.github.com/repos/me/data/contents/portfolio/trades.json?ref=main");
    expect(r.headers.Authorization).toBe("Bearer t");
  });
  test("rejects unsafe repo and file names", () => {
    expect(() => dataFileUrl("../x.json", "https://s", {})).toThrow();
    expect(() => dataFileUrl("trades.json", "https://s", { PORTFOLIO_DATA_REPO: "a/b/../../c" })).toThrow();
  });
});
