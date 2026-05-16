import type { AITaskType } from "../provider";

export type AiRunStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "timeout";

export type AiRunSourceType =
  | "rule_session"
  | "rule_review"
  | "portfolio"
  | "watchlist"
  | "reflection"
  | "document"
  | "eval_case"
  | "system";

export type AiTaskType = AITaskType;

export type SaveAiRunLogInput = {
  userId: string;
  requestId?: string;
  taskType: AiTaskType;
  sourceType?: AiRunSourceType;
  sourceId?: string;
  sessionId?: string;
  ruleReviewId?: string;
  provider: string;
  model: string;
  promptVersion?: string;
  inputJson?: unknown;
  metadata?: Record<string, unknown>;
};

export type UpdateAiRunLogInput = {
  aiRunLogId: string;
  userId: string;
  status: AiRunStatus;
  schemaValid?: boolean;
  safetyPassed?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  outputJson?: unknown;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: unknown;
  completedAt?: string;
};
