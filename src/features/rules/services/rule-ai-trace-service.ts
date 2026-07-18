import "server-only";

import { createHash } from "node:crypto";
import { createDatabaseClient } from "@/lib/db/database-client";
import { getOrCreatePrivacySettings } from "@/features/privacy/services/privacy-settings-service";

const TRACE_RETENTION_DAYS = 30;
const MAX_STORED_JSON_LENGTH = 24_000;
const REDACTION_VERSION = "rule-trace-v1";

export type RuleAiTraceStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "cache_hit"
  | "blocked";

export async function createRuleAiTrace(params: {
  userId: string;
  sessionId: string;
  questionId?: string | null;
  questionKey?: string | null;
  aiRunLogId?: string | null;
  thesisResearchRunId?: string | null;
  traceType: string;
  status: RuleAiTraceStatus;
  answerContextHash: string;
  input: unknown;
  output: unknown;
  comparisonOutput?: unknown;
  provider?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  schemaValid?: boolean | null;
  safetyPassed?: boolean | null;
  compliancePassed?: boolean | null;
  sensitiveValues?: string[];
}) {
  const privacy = await getOrCreatePrivacySettings({ userId: params.userId });
  const payloadLoggingEnabled = toBoolean(
    privacy.settings.ai_payload_logging_enabled,
  );
  const redactedInput = redactRuleTrace(params.input, params.sensitiveValues);
  const redactedOutput = redactRuleTrace(
    params.output,
    params.sensitiveValues,
  );
  const inputSerialized = JSON.stringify(redactedInput);
  const outputSerialized = JSON.stringify(redactedOutput);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_ai_trace_records")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      question_id: params.questionId ?? null,
      question_key: params.questionKey ?? null,
      ai_run_log_id: params.aiRunLogId ?? null,
      thesis_research_run_id: params.thesisResearchRunId ?? null,
      trace_type: params.traceType,
      status: params.status,
      answer_context_hash: params.answerContextHash,
      input_json: payloadLoggingEnabled
        ? truncateSerializedJson(inputSerialized)
        : null,
      output_json: payloadLoggingEnabled
        ? truncateSerializedJson(outputSerialized)
        : null,
      input_hash: hashValue(params.input),
      output_hash: hashValue(params.comparisonOutput ?? params.output),
      input_chars: inputSerialized.length,
      output_chars: outputSerialized.length,
      provider: params.provider ?? null,
      model: params.model ?? null,
      prompt_version: params.promptVersion ?? null,
      schema_valid: params.schemaValid ?? null,
      safety_passed: params.safetyPassed ?? null,
      compliance_passed: params.compliancePassed ?? null,
      redaction_version: REDACTION_VERSION,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("AI trace was not created");
  return {
    traceId: String(data.id),
    payloadLoggingEnabled,
    inputHash: hashValue(params.input),
    outputHash: hashValue(params.comparisonOutput ?? params.output),
  };
}

export async function getRuleAiTraceForResearchRun(params: {
  userId: string;
  researchRunId: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_ai_trace_records")
    .select("*")
    .eq("user_id", params.userId)
    .eq("thesis_research_run_id", params.researchRunId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getRuleAiTraceForUser(params: {
  userId: string;
  traceId: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_ai_trace_records")
    .select("*")
    .eq("id", params.traceId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function deleteRuleAiTracePayloads(params: { userId: string }) {
  const db = await createDatabaseClient();
  const { error } = await db
    .from("rule_ai_trace_records")
    .update({ input_json: null, output_json: null })
    .eq("user_id", params.userId);
  if (error) throw error;
}

export function hashValue(value: unknown) {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function redactRuleTrace(value: unknown, sensitiveValues: string[] = []) {
  const maskedValues = sensitiveValues
    .filter((item) => item.length >= 3)
    .sort((a, b) => b.length - a.length);
  return redactValue(value, maskedValues, 0);
}

function redactValue(value: unknown, sensitiveValues: string[], depth: number): unknown {
  if (depth > 8) return "[DEPTH_REDACTED]";
  if (typeof value === "string") {
    let result = value
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL_REDACTED]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [TOKEN_REDACTED]")
      .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,}]+/gi, "$1=[SECRET_REDACTED]");
    for (const sensitiveValue of sensitiveValues) {
      result = result.split(sensitiveValue).join("[PRIVATE_REDACTED]");
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, sensitiveValues, depth + 1));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactValue(item, sensitiveValues, depth + 1),
      ]),
    );
  }
  return value;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function truncateSerializedJson(value: string) {
  return value.length <= MAX_STORED_JSON_LENGTH
    ? value
    : `${value.slice(0, MAX_STORED_JSON_LENGTH)}...[TRUNCATED]`;
}

function toBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}
