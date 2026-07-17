import type { z } from "zod";

export type AIProviderKey = "mock" | "openai" | "gemini" | "codex-app-server";

export type AITaskType =
  | "intake_question"
  | "rule_draft_generation"
  | "rule_review"
  | "question_generation"
  | "loop_judgement"
  | "portfolio_review"
  | "holistic_review"
  | "portfolio_rule_guidance"
  | "watchlist_review"
  | "reflection_review"
  | "memory_summary"
  | "rag_context_summary"
  | "document_summary"
  | "safety_check"
  | "compliance_check"
  | "eval_judge"
  | "document_rag_review"
  | "portfolio_position_import"
  | "news_classify"
  | "news_summarize"
  | "embedding";

export type AIAgentName =
  | "intake_agent"
  | "rule_builder_agent"
  | "rule_review_agent"
  | "question_generator_agent"
  | "loop_manager_agent"
  | "portfolio_review_agent"
  | "holistic_review_agent"
  | "portfolio_rule_guidance_agent"
  | "watchlist_review_agent"
  | "memory_agent"
  | "safety_agent"
  | "compliance_agent"
  | "eval_agent"
  | "portfolio_import_agent";

export type AIModelCostTier =
  | "free_mock"
  | "cheap"
  | "balanced"
  | "high_quality"
  | "embedding";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string | AIMessagePart[];
};

export type AIMessagePart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail?: "low" | "high" | "auto";
      };
    };

export type AIUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
};

export type AIProviderMeta = {
  provider: string;
  model: string;
  taskType: AITaskType;
  agentName?: AIAgentName;
  promptVersion?: string;
  costTier?: AIModelCostTier;
  temperature?: number;
  maxOutputTokens?: number;
  fallbackUsed: boolean;
  latencyMs: number;
};

export type AIModelConfig = {
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
};

export type GenerateObjectParams<TSchema extends z.ZodType> = {
  taskType: AITaskType;
  agentName?: AIAgentName;
  schema: TSchema;
  schemaName: string;
  messages: AIMessage[];
  promptVersion?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type GenerateObjectResult<T> = {
  data: T;
  rawText?: string;
  usage: AIUsage;
  meta: AIProviderMeta;
};

export type GenerateTextParams = {
  taskType: AITaskType;
  agentName?: AIAgentName;
  messages: AIMessage[];
  promptVersion?: string;
  temperature?: number;
  maxOutputTokens?: number;
};

export type GenerateTextResult = {
  text: string;
  usage: AIUsage;
  meta: AIProviderMeta;
};

export type EmbedParams = {
  taskType: AITaskType;
  input: string | string[];
  model?: string;
};

export type EmbedResult = {
  embeddings: number[][];
  usage: AIUsage;
  meta: AIProviderMeta;
};

export interface AIProvider {
  generateObject<TSchema extends z.ZodType>(
    params: GenerateObjectParams<TSchema>,
  ): Promise<GenerateObjectResult<z.infer<TSchema>>>;

  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;

  embed?(params: EmbedParams): Promise<EmbedResult>;
}
