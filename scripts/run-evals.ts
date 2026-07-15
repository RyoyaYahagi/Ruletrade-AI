import { loadActiveEvalCases } from "@/lib/evals/eval-case-loader";
import { runRuleReviewEvalCase } from "@/lib/evals/eval-runner";
import {
  createEvalRun,
  saveEvalRunResult,
  completeEvalRun,
} from "@/lib/evals/save-eval-results";
import {
  getConfiguredAIProvider,
  getCodexAppServerModel,
  getOpenAIModel,
  getGeminiModel,
} from "@/lib/ai/model-config";

function getModel() {
  const provider = getConfiguredAIProvider();

  if (provider === "openai") {
    return getOpenAIModel();
  }

  if (provider === "gemini") {
    return getGeminiModel();
  }

  if (provider === "codex-app-server") {
    return getCodexAppServerModel();
  }

  return "mock-model";
}

async function main() {
  const taskType = "rule_review";
  const promptVersion = "rule-reviewer-v1";

  const cases = await loadActiveEvalCases({
    taskType,
  });

  const provider = getConfiguredAIProvider();
  const model = getModel();

  const { evalRunId } = await createEvalRun({
    runName: `Rule Review Eval ${new Date().toISOString()}`,
    taskType,
    provider,
    model,
    promptVersion,
    totalCases: cases.length,
  });

  for (const evalCase of cases) {
    try {
      const result = await runRuleReviewEvalCase({
        caseId: evalCase.id,
        inputJson: evalCase.input_json,
        expectedJson: evalCase.expected_json,
        promptVersion,
      });

      await saveEvalRunResult({
        evalRunId,
        evalCaseId: evalCase.id,
        status: result.status,
        actualJson: result.actualJson,
        expectedJson: result.expectedJson,
        matchedChecks: result.matchedChecks,
        missingChecks: result.missingChecks,
        extraChecks: result.extraChecks,
        truePositive: result.truePositive,
        falsePositive: result.falsePositive,
        falseNegative: result.falseNegative,
        precision: result.precision,
        recall: result.recall,
        f1: result.f1,
        schemaValid: result.schemaValid,
        safetyPassed: result.safetyPassed,
        latencyMs: result.latencyMs,
        estimatedCostUsd: result.estimatedCostUsd,
      });
    } catch (error) {
      await saveEvalRunResult({
        evalRunId,
        evalCaseId: evalCase.id,
        status: "error",
        expectedJson: evalCase.expected_json,
        schemaValid: false,
        safetyPassed: false,
        errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  await completeEvalRun({
    evalRunId,
  });

  console.log(`Eval run completed: ${evalRunId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
