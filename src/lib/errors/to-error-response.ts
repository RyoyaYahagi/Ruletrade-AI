import { AppError } from "@/lib/errors/app-error";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { ERROR_CODES, type ErrorCode } from "@/lib/errors/error-codes";
import { logApiError } from "@/lib/errors/log-api-error";
import { redactSensitiveData } from "@/lib/security/redact-sensitive-data";

function mapAiProviderError(error: AIProviderError): {
  statusCode: number;
  errorCode: ErrorCode;
  message: string;
} {
  switch (error.code) {
    case "AI_PROVIDER_RATE_LIMITED":
      return {
        statusCode: 429,
        errorCode: ERROR_CODES.RATE_LIMITED,
        message:
          "AIサービスの利用上限に達しました。しばらく待ってからお試しください。",
      };
    case "AI_PROVIDER_TIMEOUT":
      return {
        statusCode: 504,
        errorCode: ERROR_CODES.AI_PROVIDER_TIMEOUT,
        message:
          "AIサービスの応答がタイムアウトしました。もう一度お試しください。",
      };
    case "AI_OUTPUT_SCHEMA_INVALID":
    case "AI_OUTPUT_PARSE_FAILED":
      return {
        statusCode: 500,
        errorCode: ERROR_CODES.AI_OUTPUT_INVALID,
        message: "AIの出力形式が不正でした。もう一度お試しください。",
      };
    default:
      return {
        statusCode: 500,
        errorCode: ERROR_CODES.AI_PROVIDER_ERROR,
        message: "AIサービスでエラーが発生しました。もう一度お試しください。",
      };
  }
}

export async function toErrorResponse(
  error: unknown,
  params: {
    requestId: string;
    userId?: string | null;
    route?: string;
    method?: string;
  },
) {
  if (error instanceof AIProviderError) {
    const { statusCode, errorCode, message } = mapAiProviderError(error);

    await logApiError({
      userId: params.userId ?? null,
      requestId: params.requestId,
      route: params.route,
      method: params.method,
      errorCode,
      errorMessage: error.message,
      statusCode,
      retryable: error.retryable,
      details: error.details,
    });

    return Response.json(
      {
        ok: false,
        error: {
          code: error.code,
          message,
          requestId: params.requestId,
          retryable: error.retryable,
        },
      },
      { status: statusCode },
    );
  }

  if (error instanceof AppError) {
    await logApiError({
      userId: params.userId ?? null,
      requestId: params.requestId,
      route: params.route,
      method: params.method,
      errorCode: error.code,
      errorMessage: error.message,
      statusCode: error.status,
      retryable: error.retryable,
      details: error.details,
    });

    return Response.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: redactSensitiveData(error.details),
          requestId: params.requestId,
          retryable: error.retryable,
        },
      },
      {
        status: error.status,
      },
    );
  }

  await logApiError({
    userId: params.userId ?? null,
    requestId: params.requestId,
    route: params.route,
    method: params.method,
    errorCode: ERROR_CODES.INTERNAL_ERROR,
    errorMessage: error instanceof Error ? error.message : "Unknown error",
    statusCode: 500,
    retryable: false,
  });

  return Response.json(
    {
      ok: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: "予期しないエラーが発生しました。",
        requestId: params.requestId,
        retryable: false,
      },
    },
    {
      status: 500,
    },
  );
}
