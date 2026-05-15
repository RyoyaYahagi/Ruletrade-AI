export type RateLimitKey =
  | "ai_rule_review_hourly"
  | "ai_rule_review_daily"
  | "ai_question_generation_hourly"
  | "ai_question_generation_daily"
  | "rule_session_create_daily";

export type RateLimitConfig = {
  key: RateLimitKey;
  limit: number;
  window: "hour" | "day" | "month";
};

export const RATE_LIMIT_CONFIGS: Record<RateLimitKey, RateLimitConfig> = {
  ai_rule_review_hourly: {
    key: "ai_rule_review_hourly",
    limit: 20,
    window: "hour",
  },
  ai_rule_review_daily: {
    key: "ai_rule_review_daily",
    limit: 50,
    window: "day",
  },
  ai_question_generation_hourly: {
    key: "ai_question_generation_hourly",
    limit: 30,
    window: "hour",
  },
  ai_question_generation_daily: {
    key: "ai_question_generation_daily",
    limit: 100,
    window: "day",
  },
  rule_session_create_daily: {
    key: "rule_session_create_daily",
    limit: 30,
    window: "day",
  },
};
