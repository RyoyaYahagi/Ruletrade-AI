import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";

export async function logAiRunEvent(params: {
  aiRunLogId: string;
  userId: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await createDatabaseClient();

  const { error } = await db.from("ai_run_log_events").insert({
    ai_run_log_id: params.aiRunLogId,
    user_id: params.userId,
    event_type: params.eventType,
    message: params.message ?? null,
    metadata: params.metadata ? redactSensitiveData(params.metadata) : {},
  });

  if (error) {
    throw error;
  }
}
