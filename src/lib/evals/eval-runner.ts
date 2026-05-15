import "server-only";

import { getAIProvider } from "@/lib/ai/provider-factory";
import {
  getConfiguredAIProvider,
  getOpenAIModel,
  getGeminiModel,
} from "@/lib/ai/model-config";
import { RuleReviewSchema } from "@/schemas/rules/rule-review-schema";
import { RuleReviewExpectedSchema } from "@/schemas/evals/eval-case-schema";
import { compareExpectedChecks } from "@/lib/evals/compare-checks";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";

function getConfiguredModelForEval() {
  const provider = getConfiguredAIProvider();

  if (provider === "openai") {
    return getOpenAIModel();
  }

  if (provider === "gemini") {
    return getGeminiModel();
  }

  return "mock-model";
}

export async function runRuleReviewEvalCase(params: {
  caseId: string;
  inputJson: unknown;
  expectedJson: unknown;
  promptVersion: string;
}) {
  const ai = getAIProvider();

  const aiResult = await ai.generateObject({
    taskType: "rule_review",
    schema: RuleReviewSchema,
    schemaName: "RuleReview",
    promptVersion: params.promptVersion,
    messages: [
      {
        role: "system",
        content:
          "あなたは投資ルール設計を支援するAIです。売買推奨はせず、抜け漏れ確認を行います。",
      },
      {
        role: "user",
        content: JSON.stringify(params.inputJson),
      },
    ],
  });

  const review = aiResult.data;
  const expected = RuleReviewExpectedSchema.parse(params.expectedJson);

  const checkComparison = compareExpectedChecks({
    review,
    expectedFailedChecks: expected.expectedFailedChecks,
    expectedWarningChecks: expected.expectedWarningChecks,
  });

  const safety = runSafetyCheck({
    text: review.summary,
  });

  const canFinalizeMatches =
    expected.expectedCanFinalize === undefined ||
    expected.expectedCanFinalize === review.canFinalize;

  const needsMoreInfoMatches =
    expected.expectedNeedsMoreInfo === undefined ||
    expected.expectedNeedsMoreInfo === review.needsMoreInfo;

  const minScoreMatches =
    expected.minimumCompletionScore === undefined ||
    review.completionScore >= expected.minimumCompletionScore;

  const maxScoreMatches =
    expected.maximumCompletionScore === undefined ||
    review.completionScore <= expected.maximumCompletionScore;

  const passed =
    checkComparison.missingChecks.length === 0 &&
    canFinalizeMatches &&
    needsMoreInfoMatches &&
    minScoreMatches &&
    maxScoreMatches &&
    safety.passed;

  const status = passed ? "passed" : "failed";

  return {
    status: status as "passed" | "failed",
    actualJson: review,
    expectedJson: expected,
    matchedChecks: checkComparison.matchedChecks,
    missingChecks: checkComparison.missingChecks,
    extraChecks: checkComparison.extraChecks,
    truePositive: checkComparison.truePositive,
    falsePositive: checkComparison.falsePositive,
    falseNegative: checkComparison.falseNegative,
    precision: checkComparison.precision,
    recall: checkComparison.recall,
    f1: checkComparison.f1,
    schemaValid: true,
    safetyPassed: safety.passed,
    latencyMs: aiResult.meta.latencyMs,
    estimatedCostUsd: aiResult.usage.estimatedCostUsd ?? 0,
    provider: getConfiguredAIProvider(),
    model: getConfiguredModelForEval(),
  };
}
