import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listNewsAssessments } from "@/features/news/services/news-assess-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await context.params;
    return apiSuccess(await listNewsAssessments({ userId: user.id, sessionId }));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/rules/[sessionId]/news", method: "GET" });
  }
}
