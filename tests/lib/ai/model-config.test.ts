import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getConfiguredAIProvider,
  getOpenAIModel,
  getGeminiModel,
  getAITimeoutMs,
} from "@/lib/ai/model-config";

describe("model-config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getConfiguredAIProvider", () => {
    it("openai を返す", () => {
      vi.stubEnv("AI_PROVIDER", "openai");
      expect(getConfiguredAIProvider()).toBe("openai");
    });

    it("gemini を返す", () => {
      vi.stubEnv("AI_PROVIDER", "gemini");
      expect(getConfiguredAIProvider()).toBe("gemini");
    });

    it("mock を返す", () => {
      vi.stubEnv("AI_PROVIDER", "mock");
      expect(getConfiguredAIProvider()).toBe("mock");
    });

    it("無効な値の場合は mock にフォールバックする", () => {
      vi.stubEnv("AI_PROVIDER", "unknown");
      expect(getConfiguredAIProvider()).toBe("mock");
    });

    it("未設定の場合は mock にフォールバックする", () => {
      vi.stubEnv("AI_PROVIDER", undefined);
      expect(getConfiguredAIProvider()).toBe("mock");
    });
  });

  describe("getOpenAIModel", () => {
    it("環境変数が設定されている場合はその値を返す", () => {
      vi.stubEnv("OPENAI_MODEL", "gpt-4o");
      expect(getOpenAIModel()).toBe("gpt-4o");
    });

    it("未設定の場合はデフォルト値を返す", () => {
      vi.stubEnv("OPENAI_MODEL", undefined);
      expect(getOpenAIModel()).toBe("gpt-4.1-mini");
    });
  });

  describe("getGeminiModel", () => {
    it("環境変数が設定されている場合はその値を返す", () => {
      vi.stubEnv("GEMINI_MODEL", "gemini-pro");
      expect(getGeminiModel()).toBe("gemini-pro");
    });

    it("未設定の場合はデフォルト値を返す", () => {
      vi.stubEnv("GEMINI_MODEL", undefined);
      expect(getGeminiModel()).toBe("gemini-2.5-flash");
    });
  });

  describe("getAITimeoutMs", () => {
    it("環境変数が設定されている場合はその値を返す", () => {
      vi.stubEnv("AI_TIMEOUT_MS", "60000");
      expect(getAITimeoutMs()).toBe(60000);
    });

    it("未設定の場合はデフォルト値 30000 を返す", () => {
      vi.stubEnv("AI_TIMEOUT_MS", undefined);
      expect(getAITimeoutMs()).toBe(30000);
    });

    it("無効な値の場合はデフォルト値 30000 を返す", () => {
      vi.stubEnv("AI_TIMEOUT_MS", "invalid");
      expect(getAITimeoutMs()).toBe(30000);
    });

    it("0 以下の値の場合はデフォルト値 30000 を返す", () => {
      vi.stubEnv("AI_TIMEOUT_MS", "0");
      expect(getAITimeoutMs()).toBe(30000);
    });
  });
});
