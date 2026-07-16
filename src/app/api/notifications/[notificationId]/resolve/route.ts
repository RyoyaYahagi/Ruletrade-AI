import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { resolveRuleAlert } from "@/features/notifications/services/notification-service";
import { RuleAlertResolutionSchema } from "@/schemas/notifications/notification-schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;
  try {
    const user = await requireUser();
    userId = user.id;
    const { notificationId } = await params;
    const input = await validateJsonRequest(request, RuleAlertResolutionSchema);
    const result = await resolveRuleAlert({
      userId: user.id,
      notificationId,
      resolution: input.resolution,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/notifications/[notificationId]/resolve",
      method: "PATCH",
    });
  }
}
