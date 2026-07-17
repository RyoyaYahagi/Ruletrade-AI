import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listAttentionStatuses } from "@/features/ux/services/attention-status-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const statuses = await listAttentionStatuses({ userId: user.id });
    return apiSuccess({ statuses: Object.fromEntries(statuses) });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/attention-statuses",
      method: "GET",
    });
  }
}
