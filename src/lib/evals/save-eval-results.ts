import "server-only";

import { createClient } from "@/lib/db/supabase-server";

type EvalRunResultRow = {
  status: string;
  true_positive?: number | null;
  false_positive?: number | null;
  false_negative?: number | null;
  schema_valid?: boolean | null;
  safety_passed?: boolean | null;
  latency_ms?: number | null;
  estimated_cost_usd?: number | null;
};

export async function createEvalRun(params: {
  runName?: string;
  taskType: string;
  provider: string;
  model: string;
  promptVersion: string;
  totalCases: number;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("eval_runs")
    .insert({
      run_name: params.runName ?? null,
      task_type: params.taskType,
      provider: params.provider,
      model: params.model,
      prompt_version: params.promptVersion,
      status: "running",
      total_cases: params.totalCases,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error;
  }

  return {
    evalRunId: data.id,
  };
}

export async function saveEvalRunResult(params: {
  evalRunId: string;
  evalCaseId: string;
  aiRunLogId?: string;
  status: "passed" | "failed" | "error";
  actualJson?: unknown;
  expectedJson: unknown;
  matchedChecks?: string[];
  missingChecks?: string[];
  extraChecks?: string[];
  truePositive?: number;
  falsePositive?: number;
  falseNegative?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  schemaValid?: boolean;
  safetyPassed?: boolean;
  latencyMs?: number;
  estimatedCostUsd?: number;
  errorCode?: string;
  errorMessage?: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("eval_run_results").insert({
    eval_run_id: params.evalRunId,
    eval_case_id: params.evalCaseId,
    ai_run_log_id: params.aiRunLogId ?? null,
    status: params.status,
    actual_json: params.actualJson ?? null,
    expected_json: params.expectedJson,
    matched_checks: params.matchedChecks ?? [],
    missing_checks: params.missingChecks ?? [],
    extra_checks: params.extraChecks ?? [],
    true_positive: params.truePositive ?? 0,
    false_positive: params.falsePositive ?? 0,
    false_negative: params.falseNegative ?? 0,
    precision: params.precision ?? null,
    recall: params.recall ?? null,
    f1: params.f1 ?? null,
    schema_valid: params.schemaValid ?? null,
    safety_passed: params.safetyPassed ?? null,
    latency_ms: params.latencyMs ?? null,
    estimated_cost_usd: params.estimatedCostUsd ?? null,
    error_code: params.errorCode ?? null,
    error_message: params.errorMessage ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function completeEvalRun(params: { evalRunId: string }) {
  const supabase = await createClient();

  const { data: results, error } = await supabase
    .from("eval_run_results")
    .select("*")
    .eq("eval_run_id", params.evalRunId);

  if (error) {
    throw error;
  }

  const rows = (results ?? []) as EvalRunResultRow[];

  const totalCases = rows.length;
  const passedCases = rows.filter((row) => row.status === "passed").length;
  const failedCases = rows.filter((row) => row.status !== "passed").length;

  const tp = rows.reduce((sum, row) => sum + (row.true_positive ?? 0), 0);
  const fp = rows.reduce((sum, row) => sum + (row.false_positive ?? 0), 0);
  const fn = rows.reduce((sum, row) => sum + (row.false_negative ?? 0), 0);

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  const schemaValidRate =
    totalCases === 0
      ? 0
      : rows.filter((row) => row.schema_valid === true).length / totalCases;

  const safetyPassRate =
    totalCases === 0
      ? 0
      : rows.filter((row) => row.safety_passed === true).length / totalCases;

  const latencies = rows
    .map((row) => row.latency_ms)
    .filter((value): value is number => typeof value === "number");

  const avgLatencyMs =
    latencies.length === 0
      ? null
      : latencies.reduce((sum, value) => sum + value, 0) / latencies.length;

  const totalCost = rows.reduce(
    (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
    0,
  );

  const { error: updateError } = await supabase
    .from("eval_runs")
    .update({
      status: "completed",
      total_cases: totalCases,
      passed_cases: passedCases,
      failed_cases: failedCases,
      precision,
      recall,
      f1,
      schema_valid_rate: schemaValidRate,
      safety_pass_rate: safetyPassRate,
      avg_latency_ms: avgLatencyMs,
      total_estimated_cost_usd: totalCost,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.evalRunId);

  if (updateError) {
    throw updateError;
  }
}
