export type AITaskType =
  | "intake_question"
  | "rule_draft_generation"
  | "rule_review"
  | "question_generation"
  | "loop_judgement"
  | "portfolio_review"
  | "portfolio_rule_guidance"
  | "watchlist_review"
  | "reflection_review"
  | "memory_summary"
  | "rag_context_summary"
  | "document_summary"
  | "safety_check"
  | "compliance_check"
  | "eval_judge"
  | "embedding";

export type AIAgentName =
  | "intake_agent"
  | "rule_builder_agent"
  | "rule_review_agent"
  | "question_generator_agent"
  | "loop_manager_agent"
  | "portfolio_review_agent"
  | "portfolio_rule_guidance_agent"
  | "watchlist_review_agent"
  | "memory_agent"
  | "safety_agent"
  | "compliance_agent"
  | "eval_agent";

export type AIProviderKey = "mock" | "openai" | "gemini" | "codex-app-server";

export type AIModelCostTier =
  | "free_mock"
  | "cheap"
  | "balanced"
  | "high_quality"
  | "embedding";
