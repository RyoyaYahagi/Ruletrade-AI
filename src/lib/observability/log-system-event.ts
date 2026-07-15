import "server-only";
import { createDatabaseClient } from "@/lib/db/database-client";

export interface SystemEventInput {
  eventType: string;
  severity: "info" | "warn" | "error" | "critical";
  message: string;
  requestId?: string | null;
  userId?: string | null;
  route?: string | null;
  errorCode?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
}

export async function logSystemEvent(params: SystemEventInput): Promise<void> {
  try {
    const db = await createDatabaseClient();

    await db.from("system_events").insert({
      event_type: params.eventType,
      severity: params.severity,
      message: params.message,
      request_id: params.requestId ?? null,
      user_id: params.userId ?? null,
      route: params.route ?? null,
      error_code: params.errorCode ?? null,
      duration_ms: params.durationMs ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // System event logging must never break user requests.
  }
}
