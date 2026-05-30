import type { FeatureFlagProvider, FeatureFlagValue } from "./types";

const STATIC_FLAGS: Record<string, FeatureFlagValue> = {
  enable_ai_interview: true,
  enable_rule_review: true,
  enable_question_generation: true,
  enable_quality_gate: true,
  enable_safety_check: true,
  enable_ai_logging: true,
  enable_user_memory_rag: false,
  enable_document_rag: false,
  question_flow_variant: "one_by_one",
  ai_provider_default: "mock",
  enable_openai_provider: false,
  enable_gemini_provider: false,
  enable_mock_provider: true,
  enable_provider_fallback: true,
};

export class StaticFeatureFlagProvider implements FeatureFlagProvider {
  async getFlag<T extends FeatureFlagValue>(
    flagKey: string,
    defaultValue: T,
  ): Promise<T> {
    const value = STATIC_FLAGS[flagKey];
    if (value === undefined) return defaultValue;
    return value as T;
  }
}
