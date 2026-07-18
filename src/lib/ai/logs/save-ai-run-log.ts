import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";
import { isAiPayloadLoggingEnabled } from "@/lib/ai/logs/ai-payload-logging";
import type { SaveAiRunLogInput } from "@/lib/ai/logs/ai-run-log-types";

export async function saveAiRunLog(input: SaveAiRunLogInput) {
  const db = await createDatabaseClient();
  const payloadLoggingEnabled = await isAiPayloadLoggingEnabled(input.userId);

  const { data, error } = await db
    .from("ai_run_logs")
    .insert({
      user_id: input.userId,
      request_id: input.requestId ?? null,
      task_type: input.taskType,
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      session_id: input.sessionId ?? null,
      rule_review_id: input.ruleReviewId ?? null,
      provider: input.provider,
      model: input.model,
      prompt_version: input.promptVersion ?? null,
      status: "started",
      input_json:
        payloadLoggingEnabled && input.inputJson
          ? redactSensitiveData(input.inputJson)
          : null,
      metadata: input.metadata ? redactSensitiveData(input.metadata) : {},
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error;
  }

  return {
    aiRunLogId: data.id,
  };
}
