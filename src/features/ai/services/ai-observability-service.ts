import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createDatabaseClient } from "@/lib/db/database-client";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";
import { isAiPayloadLoggingEnabled } from "@/lib/ai/logs/ai-payload-logging";
import { AI_PROMPT_CATALOG } from "@/features/ai/config/ai-prompt-registry";
import type { CreateAiExperimentInput } from "@/schemas/ai/ai-experiment-schema";

const MAX_RUNS = 100;
const MAX_EXPERIMENTS = 50;
const MAX_PAYLOAD_PREVIEW_CHARS = 2000;
type DatabaseRow = Record<string, unknown>;
type DeveloperRun = {
  id: string;
  taskType: string;
  sourceType: string | null;
  sourceId: string | null;
  provider: string;
  model: string;
  promptVersion: string | null;
  status: string;
  schemaValid: boolean | null;
  safetyPassed: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number | null;
  inputPreview: string | null;
  outputPreview: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export async function getAiDeveloperDashboard(userId: string) {
  const db = await createDatabaseClient();
  const [logsResult, experimentsResult, payloadLoggingEnabled] =
    await Promise.all([
      db
        .from("ai_run_logs")
        .select(
          "id, task_type, source_type, source_id, provider, model, prompt_version, status, schema_valid, safety_passed, input_tokens, output_tokens, estimated_cost_usd, latency_ms, input_json, output_json, error_code, error_message, started_at, completed_at",
        )
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(MAX_RUNS),
      db
        .from("ai_experiment_notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_EXPERIMENTS),
      isAiPayloadLoggingEnabled(userId),
    ]);

  if (logsResult.error || experimentsResult.error) {
    throw new AppError(
      "DATABASE_ERROR",
      "LLM開発ダッシュボードの取得に失敗しました。",
      500,
      logsResult.error ?? experimentsResult.error,
    );
  }

  const runs: DeveloperRun[] = (logsResult.data ?? []).map(
    (row: DatabaseRow) => {
      const safetyPassed = toNullableBoolean(row.safety_passed);

      return {
        id: String(row.id),
        taskType: String(row.task_type ?? "unknown"),
        sourceType: toNullableString(row.source_type),
        sourceId: toNullableString(row.source_id),
        provider: String(row.provider ?? "unknown"),
        model: String(row.model ?? "unknown"),
        promptVersion: toNullableString(row.prompt_version),
        status: String(row.status ?? "unknown"),
        schemaValid: toNullableBoolean(row.schema_valid),
        safetyPassed,
        inputTokens: toNullableNumber(row.input_tokens),
        outputTokens: toNullableNumber(row.output_tokens),
        estimatedCostUsd: toNullableNumber(row.estimated_cost_usd),
        latencyMs: toNullableNumber(row.latency_ms),
        inputPreview: payloadLoggingEnabled
          ? toPayloadPreview(row.input_json)
          : null,
        // Raw AI output is only visible after the application's Safety Check has passed.
        outputPreview:
          payloadLoggingEnabled && safetyPassed === true
            ? toPayloadPreview(row.output_json)
            : null,
        errorCode: toNullableString(row.error_code),
        errorMessage: toNullableString(row.error_message)
          ? redactText(String(row.error_message))
          : null,
        startedAt: String(row.started_at ?? row.created_at ?? ""),
        completedAt: toNullableString(row.completed_at),
      };
    },
  );

  const experiments = (experimentsResult.data ?? []).map(
    (row: DatabaseRow) => ({
      id: String(row.id),
      title: String(row.title ?? ""),
      hypothesis: String(row.hypothesis ?? ""),
      changeSummary: String(row.change_summary ?? ""),
      result: String(row.result ?? ""),
      blockedOn: String(row.blocked_on ?? ""),
      nextStep: String(row.next_step ?? ""),
      status: String(row.status ?? "in_progress"),
      promptVersion: toNullableString(row.prompt_version),
      provider: toNullableString(row.provider),
      model: toNullableString(row.model),
      tags: Array.isArray(row.tags_json) ? row.tags_json.map(String) : [],
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    }),
  );

  return {
    payloadLoggingEnabled,
    summary: buildSummary(runs),
    promptCatalog: AI_PROMPT_CATALOG.map((prompt) => ({
      ...prompt,
      runCount: runs.filter((run) => run.promptVersion === prompt.version)
        .length,
      lastUsedAt:
        runs.find((run) => run.promptVersion === prompt.version)?.startedAt ??
        null,
    })),
    runs,
    experiments,
  };
}

export async function createAiExperimentNote(
  userId: string,
  input: CreateAiExperimentInput,
) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("ai_experiment_notes")
    .insert({
      user_id: userId,
      title: redactText(input.title),
      hypothesis: redactText(input.hypothesis),
      change_summary: redactText(input.changeSummary),
      result: redactText(input.result),
      blocked_on: redactText(input.blockedOn),
      next_step: redactText(input.nextStep),
      status: input.status,
      prompt_version: nullableText(input.promptVersion),
      provider: nullableText(input.provider),
      model: nullableText(input.model),
      tags_json: input.tags.map(redactText),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "DATABASE_ERROR",
      "LLM試行ノートの保存に失敗しました。",
      500,
      error,
    );
  }

  return {
    id: String(data.id),
    title: String(data.title),
    status: String(data.status),
    createdAt: String(data.created_at ?? ""),
  };
}

function buildSummary(
  runs: Array<{
    status: string;
    estimatedCostUsd: number | null;
    latencyMs: number | null;
    promptVersion: string | null;
  }>,
) {
  const completedRuns = runs.filter((run) => run.status === "succeeded");
  const latencyRuns = runs.filter((run) => run.latencyMs !== null);
  const totalCostUsd = runs.reduce(
    (sum, run) => sum + (run.estimatedCostUsd ?? 0),
    0,
  );

  return {
    runCount: runs.length,
    successRate: runs.length
      ? Number(((completedRuns.length / runs.length) * 100).toFixed(1))
      : null,
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    averageLatencyMs: latencyRuns.length
      ? Math.round(
          latencyRuns.reduce((sum, run) => sum + (run.latencyMs ?? 0), 0) /
            latencyRuns.length,
        )
      : null,
    promptVersionCount: new Set(
      runs.map((run) => run.promptVersion).filter(Boolean),
    ).size,
  };
}

function toPayloadPreview(value: unknown) {
  if (value === null || value === undefined) return null;
  const serialized =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!serialized) return null;
  return serialized.length > MAX_PAYLOAD_PREVIEW_CHARS
    ? `${serialized.slice(0, MAX_PAYLOAD_PREVIEW_CHARS)}\n…`
    : serialized;
}

function redactText(value: string) {
  return String(redactSensitiveData(value));
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? redactText(trimmed) : null;
}

function toNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toNullableBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return value === true || value === 1 || value === "1" || value === "true";
}
