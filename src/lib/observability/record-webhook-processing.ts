import "server-only";
import { createServerClient } from "@/lib/db/supabase-server";

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
    const supabase = await createServerClient();

    await supabase.from("webhook_processing_logs").insert({
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
