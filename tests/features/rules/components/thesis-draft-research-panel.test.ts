import { describe, expect, it } from "vitest";

import { buildTextFragmentUrl } from "@/features/rules/components/thesis-draft-research-panel";

describe("buildTextFragmentUrl", () => {
  it("既存のフラグメントを壊さずテキストフラグメントを付ける", () => {
    expect(buildTextFragmentUrl("https://example.com/ir#overview", "主力事業の成長"))
      .toBe("https://example.com/ir#:~:text=%E4%B8%BB%E5%8A%9B%E4%BA%8B%E6%A5%AD%E3%81%AE%E6%88%90%E9%95%B7");
  });

  it("text fragmentからMarkdown記法を除去する", () => {
    expect(
      buildTextFragmentUrl(
        "https://example.com/ir",
        "## **売上**が拡大し、[資料](https://example.com/report)を確認する。",
      ),
    ).toBe(
      "https://example.com/ir#:~:text=%E5%A3%B2%E4%B8%8A%E3%81%8C%E6%8B%A1%E5%A4%A7%E3%81%97%E3%80%81%E8%B3%87%E6%96%99%E3%82%92%E7%A2%BA%E8%AA%8D%E3%81%99%E3%82%8B%E3%80%82",
    );
  });
});
