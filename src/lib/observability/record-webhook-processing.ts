import "server-only";
import { createDatabaseClient } from "@/lib/db/database-client";

export interface WebhookProcessingInput {
  provider: string;
  eventType: string;
  externalEventId?: string | null;
  status: "received" | "processing" | "completed" | "failed";
  durationMs?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordWebhookProcessing(
  params: WebhookProcessingInput,
): Promise<void> {
  try {
    const db = await createDatabaseClient();

    await db.from("webhook_processing_logs").insert({
      provider: params.provider,
      event_type: params.eventType,
      external_event_id: params.externalEventId ?? null,
      status: params.status,
      duration_ms: params.durationMs ?? null,
      error_message: params.errorMessage ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Webhook logging must never break webhook handling.
  }
}
