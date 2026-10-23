import { describe, expect, test } from "vitest";
import { bankBadge } from "../shared/bankTracks";

describe("bankBadge", () => {
  test("a symbol not actually held gets no badge, at any gain", () => {
    expect(bankBadge("NVDA", 500)).toBeNull();
  });

  test("core track (ANG.JO): nothing below the approach window", () => {
    expect(bankBadge("ANG.JO", 20)).toBeNull();
  });

  test("core track: approaching within 5 points of the first rung", () => {
    expect(bankBadge("ANG.JO", 26)).toBe("approaching");
    expect(bankBadge("ANG.JO", 29.9)).toBe("approaching");
  });

  test("core track: reached at or above the first rung, and it stays reached further up", () => {
    expect(bankBadge("ANG.JO", 30)).toBe("reached");
    expect(bankBadge("ANG.JO", 95)).toBe("reached");
  });

  test("a loss gets no badge", () => {
    expect(bankBadge("ANG.JO", -40)).toBeNull();
  });
});
