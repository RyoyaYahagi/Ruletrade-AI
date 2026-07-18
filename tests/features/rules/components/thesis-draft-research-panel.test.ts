import { describe, expect, it } from "vitest";

import { buildTextFragmentUrl } from "@/features/rules/components/thesis-draft-research-panel";

describe("buildTextFragmentUrl", () => {
  it("既存のフラグメントを壊さずテキストフラグメントを付ける", () => {
    expect(buildTextFragmentUrl("https://example.com/ir#overview", "主力事業の成長"))
      .toBe("https://example.com/ir#:~:text=%E4%B8%BB%E5%8A%9B%E4%BA%8B%E6%A5%AD%E3%81%AE%E6%88%90%E9%95%B7");
  });
});
