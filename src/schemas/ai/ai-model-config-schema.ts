import { z } from "zod";

/**
 * Zod schema for AIProviderKey values.
 */
export const AIProviderKeySchema = z.enum([
  "mock",
  "openai",
  "gemini",
  "codex-app-server",
]);

/**
 * Zod schema for AITaskType values.
 */
export const AITaskTypeSchema = z.enum([
  "intake_question",
  "rule_draft_generation",
  "rule_review",
  "question_generation",
  "loop_judgement",
  "portfolio_review",
  "watchlist_review",
  "reflection_review",
  "memory_summary",
  "rag_context_summary",
  "document_summary",
  "safety_check",
  "compliance_check",
  "eval_judge",
  "embedding",
]);

/**
 * Zod schema for AIAgentName values.
 */
export const AIAgentNameSchema = z.enum([
  "intake_agent",
  "rule_builder_agent",
  "rule_review_agent",
  "question_generator_agent",
  "loop_manager_agent",
  "portfolio_review_agent",
  "watchlist_review_agent",
  "memory_agent",
  "safety_agent",
  "compliance_agent",
  "eval_agent",
]);

/**
 * Zod schema for AIModelCostTier values.
 */
export const AIModelCostTierSchema = z.enum([
  "free_mock",
  "cheap",
  "balanced",
  "high_quality",
  "embedding",
]);

/**
 * Zod schema for AIModelConfig.
 */
export const AIModelConfigSchema = z.object({
  taskType: AITaskTypeSchema,
  agentName: AIAgentNameSchema.optional(),
  provider: AIProviderKeySchema,
  model: z.string().min(1),
  fallbackProvider: AIProviderKeySchema.optional(),
  fallbackModel: z.string().optional(),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().min(0),
  costTier: AIModelCostTierSchema,
  timeoutMs: z.number().int().positive(),
  requireStructuredOutput: z.boolean(),
  requireSafetyCheck: z.boolean(),
  requireComplianceGate: z.boolean(),
  enabled: z.boolean(),
});

export type AIModelConfigInput = z.input<typeof AIModelConfigSchema>;
export type AIModelConfigOutput = z.output<typeof AIModelConfigSchema>;
