import type { RuleReviewAIOutput } from "@/schemas/rules/rule-review-schema";

export function buildRuleReviewSafetyText(review: RuleReviewAIOutput) {
  const parts: string[] = [];

  parts.push(review.summary);

  for (const check of review.qualityChecks) {
    parts.push(check.label);
    parts.push(check.reason);

    if (check.suggestedQuestion) {
      parts.push(check.suggestedQuestion);
    }
  }

  for (const question of review.nextQuestions) {
    parts.push(question.questionText);

    if (question.helpText) {
      parts.push(question.helpText);
    }
  }

  if (
    review.suggestedRuleUpdates &&
    Array.isArray(review.suggestedRuleUpdates)
  ) {
    for (const update of review.suggestedRuleUpdates) {
      if (
        typeof update === "object" &&
        update !== null &&
        "reason" in update &&
        typeof update.reason === "string"
      ) {
        parts.push(update.reason);
      }
    }
  }

  return parts.filter(Boolean).join("\n");
}
