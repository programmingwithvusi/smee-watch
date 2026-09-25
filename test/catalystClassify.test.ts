import { describe, expect, test } from "vitest";
import { classifyCatalyst } from "../src/catalystClassify";

describe("classifyCatalyst", () => {
  test("ASML/SMIC plus export-control vocabulary is high", () => {
    expect(classifyCatalyst("US tightens export controls on ASML lithography tools to China")).toBe("high");
    expect(classifyCatalyst("中芯国际 被美国列入实体清单")).toBe("high");
    expect(classifyCatalyst("Dutch government restricts ASML EUV licences")).toBe("high");
  });

  test("entity without a catalyst term is none", () => {
    expect(classifyCatalyst("ASML reports quarterly earnings")).toBe("none");
  });

  test("catalyst vocabulary without the entity is none", () => {
    expect(classifyCatalyst("US widens export controls on AI chips generally")).toBe("none");
  });

  test("unrelated text is none", () => {
    expect(classifyCatalyst("Local council approves new tram line")).toBe("none");
  });
});
