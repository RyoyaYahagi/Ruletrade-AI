import "server-only";
import { createServerClient } from "@/lib/db/supabase-server";

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
    const supabase = await createServerClient();

    await supabase.from("api_request_logs").insert({
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
