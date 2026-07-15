import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { PositionCheckRequestSchema } from "@/schemas/portfolio/portfolio-rule-schema";
import { checkPositionImpact } from "@/features/portfolio/services/portfolio-compliance-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const candidate = await validateJsonRequest(
      request,
      PositionCheckRequestSchema,
    );
    const result = await checkPositionImpact({
      userId: user.id,
      candidate,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
