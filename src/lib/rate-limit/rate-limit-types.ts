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

// MVP 固定値 — 本番前にDB管理へ移行する予定
// 参考: OpenAI GPT-4o で 1回あたり約 $0.01〜$0.05 の場合、時間20回=約$1〜$5
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
