import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getAIProvider } from "@/lib/ai/provider-factory";
import { MockProvider } from "@/lib/ai/providers/mock-provider";

describe("provider-factory", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("未設定時に MockProvider を返す", () => {
    vi.stubEnv("AI_PROVIDER", undefined);
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("mock 設定時に MockProvider を返す", () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(MockProvider);
  });

  it("openai 設定時に OpenAIProvider を返す（APIキーあり）", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const provider = getAIProvider();
    expect(provider.constructor.name).toBe("OpenAIProvider");
  });

  it("gemini 設定時に GeminiProvider を返す（APIキーあり）", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const provider = getAIProvider();
    expect(provider.constructor.name).toBe("GeminiProvider");
  });

  it("codex-app-server 設定時に CodexAppServerProvider を返す", () => {
    vi.stubEnv("AI_PROVIDER", "codex-app-server");
    const provider = getAIProvider();
    expect(provider.constructor.name).toBe("CodexAppServerProvider");
  });

  it("無効な値の場合は MockProvider にフォールバックする", () => {
    vi.stubEnv("AI_PROVIDER", "unknown");
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(MockProvider);
  });
});
