import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { deleteTarget } from "@/features/portfolio/services/portfolio-target-service";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ targetId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { targetId } = await context.params;
    return apiSuccess(await deleteTarget({ userId: user.id, targetId }));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/portfolio/targets/[targetId]", method: "DELETE" });
  }
}
