import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";

export async function logAiRunEvent(params: {
  aiRunLogId: string;
  userId: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerClient();

  const { error } = await supabase.from("ai_run_log_events").insert({
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
