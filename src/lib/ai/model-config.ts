import "server-only";

import type {
  AIAgentName,
  AIProviderKey,
  AITaskType,
  AIModelConfig,
  AIModelCostTier,
} from "./provider";

export type { AIProviderKey } from "./provider";

export function getConfiguredAIProvider(): AIProviderKey {
  const provider = process.env.AI_PROVIDER;

  if (
    provider === "openai" ||
    provider === "gemini" ||
    provider === "mock" ||
    provider === "codex-app-server"
  ) {
    return provider;
  }

  return "mock";
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export function getCodexAppServerModel(): string {
  return process.env.CODEX_APP_SERVER_MODEL ?? "gpt-5.4-mini";
}

export function getAITimeoutMs(): number {
  const raw = process.env.AI_TIMEOUT_MS;
  if (!raw) {
    return 30_000;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}

function envModel(taskType: AITaskType, fallback: string): string {
  const envKey = `AI_MODEL_${taskType.toUpperCase().replace(/\W/g, "_")}`;
  return process.env[envKey] ?? fallback;
}

const defaultProvider: AIProviderKey = getConfiguredAIProvider();

export const DEFAULT_AI_MODEL_CONFIGS: AIModelConfig[] = [
  {
    taskType: "intake_question",
    agentName: "intake_agent",
    provider: defaultProvider,
    model: envModel("intake_question", "gpt-4.1-mini"),
    temperature: 0.5,
    maxOutputTokens: 2048,
    costTier: "cheap",
    timeoutMs: 15_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "rule_draft_generation",
    agentName: "rule_builder_agent",
    provider: defaultProvider,
    model: envModel("rule_draft_generation", "gpt-4.1"),
    temperature: 0.4,
    maxOutputTokens: 4096,
    costTier: "balanced",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  {
    taskType: "rule_review",
    agentName: "rule_review_agent",
    provider: defaultProvider,
    model: envModel("rule_review", "gpt-4.1"),
    temperature: 0.3,
    maxOutputTokens: 4096,
    costTier: "balanced",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  {
    taskType: "question_generation",
    agentName: "question_generator_agent",
    provider: defaultProvider,
    model: envModel("question_generation", "gpt-4.1-mini"),
    temperature: 0.5,
    maxOutputTokens: 2048,
    costTier: "cheap",
    timeoutMs: 15_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "loop_judgement",
    agentName: "loop_manager_agent",
    provider: defaultProvider,
    model: envModel("loop_judgement", "gpt-4.1-mini"),
    temperature: 0.2,
    maxOutputTokens: 1024,
    costTier: "cheap",
    timeoutMs: 10_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "portfolio_review",
    agentName: "portfolio_review_agent",
    provider: defaultProvider,
    model: envModel("portfolio_review", "gpt-4.1"),
    temperature: 0.3,
    maxOutputTokens: 4096,
    costTier: "balanced",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  {
    taskType: "portfolio_position_import",
    agentName: "portfolio_import_agent",
    provider: defaultProvider,
    model: envModel("portfolio_position_import", "gpt-4.1-mini"),
    temperature: 0.1,
    maxOutputTokens: 4096,
    costTier: "balanced",
    timeoutMs: 45_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "portfolio_rule_guidance",
    agentName: "portfolio_rule_guidance_agent",
    provider: defaultProvider,
    model: envModel("portfolio_rule_guidance", "gpt-4.1-mini"),
    temperature: 0.4,
    maxOutputTokens: 3000,
    costTier: "cheap",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  {
    taskType: "watchlist_review",
    agentName: "watchlist_review_agent",
    provider: defaultProvider,
    model: envModel("watchlist_review", "gpt-4.1"),
    temperature: 0.3,
    maxOutputTokens: 4096,
    costTier: "balanced",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  {
    taskType: "reflection_review",
    agentName: "rule_review_agent",
    provider: defaultProvider,
    model: envModel("reflection_review", "gpt-4.1"),
    temperature: 0.3,
    maxOutputTokens: 4096,
    costTier: "balanced",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  {
    taskType: "memory_summary",
    agentName: "memory_agent",
    provider: defaultProvider,
    model: envModel("memory_summary", "gpt-4.1-mini"),
    temperature: 0.4,
    maxOutputTokens: 2048,
    costTier: "cheap",
    timeoutMs: 15_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "rag_context_summary",
    agentName: "memory_agent",
    provider: defaultProvider,
    model: envModel("rag_context_summary", "gpt-4.1-mini"),
    temperature: 0.4,
    maxOutputTokens: 2048,
    costTier: "cheap",
    timeoutMs: 15_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "document_summary",
    agentName: "memory_agent",
    provider: defaultProvider,
    model: envModel("document_summary", "gpt-4.1"),
    temperature: 0.3,
    maxOutputTokens: 8192,
    costTier: "balanced",
    timeoutMs: 45_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "safety_check",
    agentName: "safety_agent",
    provider: defaultProvider,
    model: envModel("safety_check", "gpt-4.1-mini"),
    temperature: 0.1,
    maxOutputTokens: 1024,
    costTier: "cheap",
    timeoutMs: 10_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "compliance_check",
    agentName: "compliance_agent",
    provider: defaultProvider,
    model: envModel("compliance_check", "gpt-4.1-mini"),
    temperature: 0.1,
    maxOutputTokens: 1024,
    costTier: "cheap",
    timeoutMs: 10_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "eval_judge",
    agentName: "eval_agent",
    provider: defaultProvider,
    model: envModel("eval_judge", "gpt-4.1"),
    temperature: 0.2,
    maxOutputTokens: 2048,
    costTier: "high_quality",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
  {
    taskType: "embedding",
    agentName: "memory_agent",
    provider: defaultProvider,
    model: envModel("embedding", "text-embedding-3-small"),
    temperature: 0,
    maxOutputTokens: 0,
    costTier: "embedding",
    timeoutMs: 15_000,
    requireStructuredOutput: false,
    requireSafetyCheck: false,
    requireComplianceGate: false,
    enabled: true,
  },
];

export type ResolveAIModelConfigOptions = {
  taskType: AITaskType;
  agentName?: AIAgentName;
};

export function resolveAIModelConfig(
  options: ResolveAIModelConfigOptions,
): AIModelConfig {
  const { taskType, agentName } = options;

  // 1. agentName + taskType で完全一致
  let config = DEFAULT_AI_MODEL_CONFIGS.find(
    (c) => c.taskType === taskType && c.agentName === agentName,
  );

  // 2. agentName 無しの taskType 一致
  if (!config) {
    config = DEFAULT_AI_MODEL_CONFIGS.find((c) => c.taskType === taskType);
  }

  if (!config) {
    throw new Error(`No AIModelConfig found for taskType: ${taskType}`);
  }

  if (!config.enabled) {
    throw new Error(`AIModelConfig is disabled for taskType: ${taskType}`);
  }

  // 3. 環境変数による provider override
  const providerOverride = process.env.AI_PROVIDER as AIProviderKey | undefined;

  if (
    providerOverride &&
    (providerOverride === "openai" ||
      providerOverride === "gemini" ||
      providerOverride === "mock" ||
      providerOverride === "codex-app-server")
  ) {
    return {
      ...config,
      provider: providerOverride,
      fallbackProvider:
        config.fallbackProvider === providerOverride
          ? undefined
          : config.fallbackProvider,
    };
  }

  return config;
}
