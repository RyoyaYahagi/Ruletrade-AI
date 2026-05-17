import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";
import type { ErrorCode } from "@/lib/errors/error-codes";

export async function logApiError(params: {
  userId?: string | null;
  requestId: string;
  route?: string;
  method?: string;
  errorCode: ErrorCode;
  errorMessage: string;
  statusCode: number;
  retryable?: boolean;
  details?: unknown;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = createAdminClient();

    await supabase.from("api_error_logs").insert({
      user_id: params.userId ?? null,
      request_id: params.requestId,
      route: params.route ?? null,
      method: params.method ?? null,
      error_code: params.errorCode,
      error_message: redactSensitiveData(params.errorMessage),
      status_code: params.statusCode,
      retryable: params.retryable ?? false,
      details: params.details ? redactSensitiveData(params.details) : null,
      metadata: params.metadata ? redactSensitiveData(params.metadata) : {},
    });
  } catch (logError) {
    console.error("[logApiError] エラーログ保存失敗:", logError);
  }
}
