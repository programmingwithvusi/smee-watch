import { describe, expect, test } from "vitest";
import { classify, mentionsEntity } from "../src/classify";

describe("entity matching", () => {
  test("matches SMEE names in Chinese and English", () => {
    expect(mentionsEntity("上海微电子装备(集团)股份有限公司")).toBe(true);
    expect(mentionsEntity("Shanghai Micro Electronics Equipment files for IPO")).toBe(true);
    expect(mentionsEntity("SMEE lithography tool shipped")).toBe(true);
    expect(mentionsEntity("芯上微装 完成融资")).toBe(true);
  });

  test("does NOT confuse 芯上微装 (AMIES) with 芯碁微装 (688630, unrelated listed company)", () => {
    expect(mentionsEntity("芯碁微装 发布上市公告")).toBe(false);
  });

  test("does not match unrelated words", () => {
    expect(mentionsEntity("Mr Smee from Peter Pan")).toBe(false);
    expect(mentionsEntity("ASML raises guidance")).toBe(false);
  });
});

describe("signal classification", () => {
  test("entity + listing vocabulary is high", () => {
    expect(classify("上海微电子 拟借壳上市")).toBe("high");
    expect(classify("上海微电子 完成科创板IPO辅导备案")).toBe("high");
    expect(classify("SMEE reverse merger talks reported")).toBe("high");
  });

  test("entity without listing vocabulary is low", () => {
    expect(classify("上海微电子 中标光刻机采购项目")).toBe("low");
  });

  test("no entity is none even with listing vocabulary", () => {
    expect(classify("某公司 科创板 上市")).toBe("none");
  });
});
