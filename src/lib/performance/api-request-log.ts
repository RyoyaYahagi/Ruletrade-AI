import "server-only";
import { createDatabaseClient } from "@/lib/db/database-client";

export interface ApiRequestLogInput {
  requestId: string;
  userId: string | null;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  errorCode: string | null;
}

export async function logApiRequest(params: ApiRequestLogInput): Promise<void> {
  try {
    const db = await createDatabaseClient();

    await db.from("api_request_logs").insert({
      request_id: params.requestId,
      user_id: params.userId,
      route: params.route,
      method: params.method,
      status_code: params.statusCode,
      duration_ms: params.durationMs,
      error_code: params.errorCode,
    });
  } catch {
    // API logging must never break user requests.
  }
}
