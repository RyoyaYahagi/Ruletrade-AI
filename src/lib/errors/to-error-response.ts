import { AppError } from "@/lib/errors/app-error";
import { logApiError } from "@/lib/errors/log-api-error";

export async function toErrorResponse(
  error: unknown,
  params: {
    requestId: string;
    userId?: string | null;
    route?: string;
    method?: string;
  },
) {
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
          details: error.details,
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
    errorCode: "INTERNAL_ERROR",
    errorMessage: error instanceof Error ? error.message : "Unknown error",
    statusCode: 500,
    retryable: false,
  });

  return Response.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
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
