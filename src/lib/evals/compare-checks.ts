import { calculatePrecisionRecallF1 } from "@/lib/evals/metrics";
import type { RuleReviewOutput } from "@/schemas/rules/rule-review-schema";

export function compareExpectedChecks(params: {
  review: RuleReviewOutput;
  expectedFailedChecks?: string[];
  expectedWarningChecks?: string[];
}) {
  const expectedProblemChecks = new Set([
    ...(params.expectedFailedChecks ?? []),
    ...(params.expectedWarningChecks ?? []),
  ]);

  const actualProblemChecks = new Set(
    params.review.qualityChecks
      .filter((check) => check.status === "fail" || check.status === "warning")
      .map((check) => check.checkKey),
  );

  const matchedChecks: string[] = [];
  const missingChecks: string[] = [];
  const extraChecks: string[] = [];

  for (const expected of expectedProblemChecks) {
    if (actualProblemChecks.has(expected)) {
      matchedChecks.push(expected);
    } else {
      missingChecks.push(expected);
    }
  }

  for (const actual of actualProblemChecks) {
    if (!expectedProblemChecks.has(actual)) {
      extraChecks.push(actual);
    }
  }

  const metrics = calculatePrecisionRecallF1({
    truePositive: matchedChecks.length,
    falsePositive: extraChecks.length,
    falseNegative: missingChecks.length,
  });

  return {
    matchedChecks,
    missingChecks,
    extraChecks,
    ...metrics,
  };
}
