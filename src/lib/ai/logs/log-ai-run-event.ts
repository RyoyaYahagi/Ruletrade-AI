import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";

export async function logAiRunEvent(params: {
  aiRunLogId: string;
  userId: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = createAdminClient();

    await supabase.from("ai_run_log_events").insert({
      ai_run_log_id: params.aiRunLogId,
      user_id: params.userId,
      event_type: params.eventType,
      message: params.message ?? null,
      metadata: params.metadata ? redactSensitiveData(params.metadata) : {},
    });
  } catch (error) {
    console.error("[logAiRunEvent] イベントログ保存失敗:", error);
  }
}
