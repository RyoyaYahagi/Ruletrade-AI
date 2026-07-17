import { describe, expect, it } from "vitest";
import { matchNewsToTickers } from "@/lib/news/news-ticker-matcher";
import { contentHash } from "@/features/news/services/news-fetch-service";

describe("matchNewsToTickers", () => {
  const candidates = [
    { symbol: "7203", companyName: "トヨタ自動車", market: "JP" },
    { symbol: "6758", companyName: "株式会社ソニーグループ", market: "JP" },
  ];

  it("matches a ticker code as a token but not as a partial number", () => {
    expect(
      matchNewsToTickers({ text: "7203 の決算と 17203 の文字列", candidates }),
    ).toEqual([{ ...candidates[0], matchMethod: "ticker_code" }]);
  });

  it("matches a company name after removing the Japanese corporate prefix", () => {
    expect(
      matchNewsToTickers({ text: "トヨタ自動車が資料を公開", candidates }),
    ).toEqual([{ ...candidates[0], matchMethod: "company_name" }]);
  });

  it("uses title and URL deterministically for deduplication", () => {
    expect(contentHash("title", "https://example.com/a")).toBe(
      contentHash("title", "https://example.com/a"),
    );
    expect(contentHash("title", "https://example.com/a")).not.toBe(
      contentHash("title", "https://example.com/b"),
    );
  });
});
