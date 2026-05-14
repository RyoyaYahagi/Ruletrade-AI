import "server-only";

import {
  SafetyCheckSchema,
  type SafetyCheck,
} from "@/schemas/safety/safety-check-schema";
import { detectProhibitedPhrases } from "@/lib/safety/detect-prohibited-phrases";

export const SAFETY_RULE_VERSION = "safety-rules-v1";

export function runSafetyCheck(params: {
  text: string;
  context?: {
    taskType?: string;
    sourceType?: string;
  };
}): SafetyCheck {
  const detected = detectProhibitedPhrases(params.text);

  const hasHighRisk = detected.some((item) => item.riskLevel === "high");
  const hasMediumRisk = detected.some((item) => item.riskLevel === "medium");

  const riskLevel = hasHighRisk ? "high" : hasMediumRisk ? "medium" : "low";

  const result = {
    passed: detected.length === 0,
    riskLevel,
    violations: detected.map((item) => ({
      type: item.type,
      phrase: item.phrase,
      reason: item.reason,
    })),
    prohibitedPhrasesDetected: detected.map((item) => item.phrase),
    suggestedRewrite:
      detected.length > 0
        ? "売買判断を促す表現を避け、ユーザー自身のルール確認を支援する表現に書き換えてください。"
        : undefined,
  };

  return SafetyCheckSchema.parse(result);
}
