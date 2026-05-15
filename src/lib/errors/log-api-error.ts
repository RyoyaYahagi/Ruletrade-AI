import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";

export async function logApiError(params: {
  userId?: string | null;
  requestId: string;
  route?: string;
  method?: string;
  errorCode: string;
  errorMessage: string;
  statusCode: number;
  retryable?: boolean;
  details?: unknown;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = await createClient();

    await supabase.from("api_error_logs").insert({
      user_id: params.userId ?? null,
      request_id: params.requestId,
      route: params.route ?? null,
      method: params.method ?? null,
      error_code: params.errorCode,
      error_message: params.errorMessage,
      status_code: params.statusCode,
      retryable: params.retryable ?? false,
      details: params.details
        ? redactSensitiveData(params.details)
        : null,
      metadata: params.metadata
        ? redactSensitiveData(params.metadata)
        : {},
    });
  } catch {
    // エラーログ保存の失敗で本処理を壊さない
  }
}
