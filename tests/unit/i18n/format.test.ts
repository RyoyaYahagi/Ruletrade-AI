import { describe, expect, test } from "vitest";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatPercent,
} from "@/i18n/format";

describe("i18n format", () => {
  test("JPYを日本語localeで表示する", () => {
    const value = formatCurrency(980, "ja", "JPY");
    expect(value).toContain("980");
  });

  test("numberをlocaleに応じて表示する", () => {
    expect(formatNumber(1234567, "ja")).toBeTruthy();
    expect(formatNumber(1234567, "en")).toBeTruthy();
  });

  test("日付をlocaleに応じて表示する", () => {
    const date = new Date("2026-05-20T10:00:00Z");
    expect(formatDate(date, "ja")).toBeTruthy();
    expect(formatDate(date, "en")).toBeTruthy();
  });

  test("パーセントを表示する", () => {
    expect(formatPercent(0.123, "ja")).toContain("%");
  });
});
