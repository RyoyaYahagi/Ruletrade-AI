import type { AIAgentName, AIProviderKey, AITaskType, AIModelCostTier } from "./ai-task-types";

export interface AIModelConfig {
  taskType: AITaskType;
  agentName?: AIAgentName;
  provider: AIProviderKey;
  model: string;
  fallbackProvider?: AIProviderKey;
  fallbackModel?: string;
  temperature: number;
  maxOutputTokens: number;
  costTier: AIModelCostTier;
  timeoutMs: number;
  requireStructuredOutput: boolean;
  requireSafetyCheck: boolean;
  requireComplianceGate: boolean;
  enabled: boolean;
}

function envModel(taskType: AITaskType, fallback: string): string {
  const envKey = `AI_MODEL_${taskType.toUpperCase().replace(/\W/g, "_")}`;
  return process.env[envKey] ?? fallback;
}

function getConfiguredProvider(): AIProviderKey {
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

const defaultProvider: AIProviderKey = getConfiguredProvider();

export const DEFAULT_AI_MODEL_CONFIGS: Record<AITaskType, AIModelConfig> = {
  intake_question: {
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
  rule_draft_generation: {
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
  rule_review: {
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
  question_generation: {
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
  loop_judgement: {
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
  portfolio_review: {
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
  portfolio_rule_guidance: {
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
  watchlist_review: {
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
  reflection_review: {
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
  memory_summary: {
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
  rag_context_summary: {
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
  document_summary: {
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
  safety_check: {
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
  compliance_check: {
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
  eval_judge: {
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
  news_classify: {
    taskType: "news_classify",
    agentName: "memory_agent",
    provider: defaultProvider,
    model: envModel("news_classify", "gpt-4.1-mini"),
    temperature: 0.1,
    maxOutputTokens: 512,
    costTier: "cheap",
    timeoutMs: 15_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  news_summarize: {
    taskType: "news_summarize",
    agentName: "memory_agent",
    provider: defaultProvider,
    model: envModel("news_summarize", "gpt-4.1"),
    temperature: 0.2,
    maxOutputTokens: 1024,
    costTier: "balanced",
    timeoutMs: 30_000,
    requireStructuredOutput: true,
    requireSafetyCheck: true,
    requireComplianceGate: true,
    enabled: true,
  },
  embedding: {
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
};
