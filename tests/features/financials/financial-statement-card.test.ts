import { describe, expect, it } from "vitest";
import { formatFinancialValue } from "@/features/financials/components/financial-statement-card";

describe("financial statement card", () => {
  it("未取得値を明示する", () => {
    expect(formatFinancialValue(null)).toBe("未取得");
    expect(formatFinancialValue(undefined)).toBe("未取得");
    expect(formatFinancialValue(1234.5)).toContain("1,234.5");
  });
});
