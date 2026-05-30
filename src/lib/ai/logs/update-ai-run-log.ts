import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";
import type { UpdateAiRunLogInput } from "@/lib/ai/logs/ai-run-log-types";

export async function updateAiRunLog(input: UpdateAiRunLogInput) {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("ai_run_logs")
    .update({
      status: input.status,
      schema_valid: input.schemaValid ?? null,
      safety_passed: input.safetyPassed ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      estimated_cost_usd: input.estimatedCostUsd ?? null,
      latency_ms: input.latencyMs ?? null,
      output_json: input.outputJson
        ? redactSensitiveData(input.outputJson)
        : null,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      error_details: input.errorDetails
        ? redactSensitiveData(input.errorDetails)
        : null,
      completed_at: input.completedAt ?? new Date().toISOString(),
    })
    .eq("id", input.aiRunLogId)
    .eq("user_id", input.userId);

  if (error) {
    throw error;
  }
}
