import type { z } from "zod";

export type AITaskType =
  | "rule_review"
  | "question_generation"
  | "safety_check"
  | "portfolio_review"
  | "watchlist_review"
  | "reflection_review"
  | "document_rag_review"
  | "embedding"
  | "eval";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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
  promptVersion?: string;
  latencyMs: number;
};

export type GenerateObjectParams<TSchema extends z.ZodType> = {
  taskType: AITaskType;
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
    params: GenerateObjectParams<TSchema>
  ): Promise<GenerateObjectResult<z.infer<TSchema>>>;

  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;

  embed?(params: EmbedParams): Promise<EmbedResult>;
}
