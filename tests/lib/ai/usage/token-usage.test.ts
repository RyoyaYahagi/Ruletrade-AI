import { describe, expect, it } from "vitest";
import { normalizeAIUsage, zeroAIUsage } from "@/lib/ai/usage/token-usage";

describe("normalizeAIUsage", () => {
  it("両方 undefined の場合に totalTokens が 0 になる", () => {
    const result = normalizeAIUsage({
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    });
    expect(result.totalTokens).toBe(0);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it("inputTokens のみ指定された場合に totalTokens が正しく計算される", () => {
    const result = normalizeAIUsage({
      inputTokens: 10,
      outputTokens: undefined,
      totalTokens: undefined,
    });
    expect(result.totalTokens).toBe(10);
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(0);
  });

  it("outputTokens のみ指定された場合に totalTokens が正しく計算される", () => {
    const result = normalizeAIUsage({
      inputTokens: undefined,
      outputTokens: 20,
      totalTokens: undefined,
    });
    expect(result.totalTokens).toBe(20);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(20);
  });

  it("totalTokens が明示的に指定されている場合はそれを優先する", () => {
    const result = normalizeAIUsage({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 50,
    });
    expect(result.totalTokens).toBe(50);
  });

  it("NaN が混入しない", () => {
    const result = normalizeAIUsage({});
    expect(result.totalTokens).not.toBeNaN();
    expect(result.inputTokens).not.toBeNaN();
    expect(result.outputTokens).not.toBeNaN();
  });
});

describe("zeroAIUsage", () => {
  it("すべて 0 である", () => {
    expect(zeroAIUsage.inputTokens).toBe(0);
    expect(zeroAIUsage.outputTokens).toBe(0);
    expect(zeroAIUsage.totalTokens).toBe(0);
    expect(zeroAIUsage.estimatedCostUsd).toBe(0);
  });
});
