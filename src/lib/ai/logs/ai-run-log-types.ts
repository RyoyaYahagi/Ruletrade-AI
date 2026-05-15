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

export type AiTaskType =
  | "rule_review"
  | "question_generation"
  | "safety_check"
  | "portfolio_review"
  | "watchlist_review"
  | "reflection_review"
  | "document_rag_review"
  | "embedding"
  | "eval";

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
