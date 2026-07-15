import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getConfiguredAIProvider,
  getCodexAppServerModel,
  getOpenAIModel,
  getGeminiModel,
  getAITimeoutMs,
  resolveAIModelConfig,
  DEFAULT_AI_MODEL_CONFIGS,
} from "@/lib/ai/model-config";

import type { AITaskType } from "@/lib/ai/provider";

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

    it("codex-app-server を返す", () => {
      vi.stubEnv("AI_PROVIDER", "codex-app-server");
      expect(getConfiguredAIProvider()).toBe("codex-app-server");
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

  describe("getCodexAppServerModel", () => {
    it("環境変数が設定されている場合はその値を返す", () => {
      vi.stubEnv("CODEX_APP_SERVER_MODEL", "gpt-5.4");
      expect(getCodexAppServerModel()).toBe("gpt-5.4");
    });

    it("未設定の場合はデフォルト値を返す", () => {
      vi.stubEnv("CODEX_APP_SERVER_MODEL", undefined);
      expect(getCodexAppServerModel()).toBe("gpt-5.4-mini");
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

  describe("DEFAULT_AI_MODEL_CONFIGS", () => {
    it("全 taskType が含まれている", () => {
      const taskTypes = DEFAULT_AI_MODEL_CONFIGS.map((c) => c.taskType);
      expect(taskTypes).toContain("rule_review");
      expect(taskTypes).toContain("safety_check");
      expect(taskTypes).toContain("eval_judge");
      expect(taskTypes).toContain("embedding");
    });

    it("全て enabled である", () => {
      for (const config of DEFAULT_AI_MODEL_CONFIGS) {
        expect(config.enabled).toBe(true);
      }
    });
  });

  describe("resolveAIModelConfig", () => {
    it("rule_review の config を返す", () => {
      const config = resolveAIModelConfig({ taskType: "rule_review" });
      expect(config.taskType).toBe("rule_review");
      expect(config.agentName).toBe("rule_review_agent");
      expect(config.costTier).toBe("balanced");
    });

    it("safety_check は低 temperature (0.1)", () => {
      const config = resolveAIModelConfig({ taskType: "safety_check" });
      expect(config.taskType).toBe("safety_check");
      expect(config.temperature).toBe(0.1);
      expect(config.agentName).toBe("safety_agent");
    });

    it("compliance_check も低 temperature (0.1)", () => {
      const config = resolveAIModelConfig({ taskType: "compliance_check" });
      expect(config.taskType).toBe("compliance_check");
      expect(config.temperature).toBe(0.1);
      expect(config.agentName).toBe("compliance_agent");
    });

    it("eval_judge は high_quality", () => {
      const config = resolveAIModelConfig({ taskType: "eval_judge" });
      expect(config.taskType).toBe("eval_judge");
      expect(config.costTier).toBe("high_quality");
      expect(config.agentName).toBe("eval_agent");
    });

    it("agentName を指定して一致する config を返す", () => {
      const config = resolveAIModelConfig({
        taskType: "rule_review",
        agentName: "rule_review_agent",
      });
      expect(config.agentName).toBe("rule_review_agent");
    });

    it("存在しない taskType はエラーになる", () => {
      expect(() =>
        resolveAIModelConfig({ taskType: "nonexistent" as AITaskType }),
      ).toThrow("No AIModelConfig found for taskType: nonexistent");
    });

    it("provider override が環境変数から反映される", () => {
      vi.stubEnv("AI_PROVIDER", "gemini");
      const config = resolveAIModelConfig({ taskType: "rule_review" });
      expect(config.provider).toBe("gemini");
    });

    it("codex-app-server の provider override が反映される", () => {
      vi.stubEnv("AI_PROVIDER", "codex-app-server");
      const config = resolveAIModelConfig({ taskType: "rule_review" });
      expect(config.provider).toBe("codex-app-server");
    });
  });
});
