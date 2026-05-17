import { describe, expect, it, vi } from "vitest";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { MockProvider } from "@/lib/ai/providers/mock-provider";

describe("getAIProvider", () => {
  it("returns MockProvider when AI_PROVIDER is mock", () => {
    vi.stubEnv("AI_PROVIDER", "mock");

    const provider = getAIProvider();

    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("falls back to MockProvider for unknown provider keys", () => {
    vi.stubEnv("AI_PROVIDER", "unknown-provider");

    const provider = getAIProvider();

    expect(provider).toBeInstanceOf(MockProvider);
  });
});
