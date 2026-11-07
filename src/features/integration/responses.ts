export type IntegrationErrorCode =
  | "unauthorized"
  | "not_found"
  | "validation_error"
  | "method_not_allowed"
  | "idempotency_key_reused"
  | "internal_error";

const errorDefinitions: Record<
  IntegrationErrorCode,
  { status: number; message: string }
> = {
  unauthorized: { status: 401, message: "認証に失敗しました。" },
  not_found: { status: 404, message: "リソースが見つかりません。" },
  validation_error: {
    status: 400,
    message: "リクエストの形式が正しくありません。",
  },
  method_not_allowed: {
    status: 405,
    message: "このメソッドは許可されていません。",
  },
  idempotency_key_reused: {
    status: 409,
    message: "同じ clientRequestId が別のリクエストで使用されています。",
  },
  internal_error: {
    status: 500,
    message: "サーバー内部でエラーが発生しました。",
  },
};

const commonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
} as const;

export function successResponse<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ generatedAt: new Date().toISOString(), data }),
    { status, headers: commonHeaders },
  );
}

export function errorResponse(
  code: IntegrationErrorCode,
  message = errorDefinitions[code].message,
): Response {
  const definition = errorDefinitions[code];
  return new Response(JSON.stringify({ error: { code, message } }), {
    status: definition.status,
    headers:
      code === "unauthorized"
        ? { ...commonHeaders, "WWW-Authenticate": "Bearer" }
        : commonHeaders,
  });
}

export function validationErrorResponse(
  message = errorDefinitions.validation_error.message,
): Response {
  return errorResponse("validation_error", message);
}

export function internalErrorResponse(): Response {
  return errorResponse("internal_error");
}
