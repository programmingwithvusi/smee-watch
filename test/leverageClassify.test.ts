import { describe, expect, test } from "vitest";
import { classifyLeverage } from "../src/leverageClassify";

describe("classifyLeverage", () => {
  test("entity plus IPO/listing vocabulary is high", () => {
    expect(classifyLeverage("Anthropic files confidentially for an IPO")).toBe("high");
    expect(classifyLeverage("OpenAI considers a public listing within two years")).toBe("high");
    expect(classifyLeverage("Anthropic eases secondary market restrictions for employees")).toBe("high");
  });

  test("entity without IPO/listing vocabulary is none", () => {
    expect(classifyLeverage("Anthropic reports strong revenue growth")).toBe("none");
  });

  test("IPO vocabulary without the entity is none", () => {
    expect(classifyLeverage("Fintech startup files for IPO")).toBe("none");
  });

  test("unrelated text is none", () => {
    expect(classifyLeverage("Local council approves new tram line")).toBe("none");
  });
});
