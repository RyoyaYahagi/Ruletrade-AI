import { AppError } from "@/lib/errors/app-error";

export function toErrorResponse(error: unknown, requestId?: string) {
  if (error instanceof AppError) {
    return Response.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
          retryable: error.retryable,
        },
      },
      {
        status: error.status,
      }
    );
  }

  return Response.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "予期しないエラーが発生しました。",
        requestId,
        retryable: false,
      },
    },
    {
      status: 500,
    }
  );
}
