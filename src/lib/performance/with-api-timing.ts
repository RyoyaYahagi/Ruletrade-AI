import "server-only";

import { logApiRequest } from "./api-request-log";

export async function withApiTiming<T>(params: {
  requestId: string;
  userId?: string | null;
  route: string;
  method: string;
  handler: () => Promise<{
    response: Response;
    statusCode: number;
    errorCode?: string | null;
  }>;
}): Promise<Response> {
  const startedAt = Date.now();

  let statusCode = 500;
  let errorCode: string | null = null;

  try {
    const result = await params.handler();

    statusCode = result.statusCode;
    errorCode = result.errorCode ?? null;

    return result.response;
  } finally {
    const durationMs = Date.now() - startedAt;

    if (process.env.ENABLE_API_REQUEST_LOGS !== "false") {
      void logApiRequest({
        requestId: params.requestId,
        userId: params.userId ?? null,
        route: params.route,
        method: params.method,
        statusCode,
        durationMs,
        errorCode,
      });
    }
  }
}
