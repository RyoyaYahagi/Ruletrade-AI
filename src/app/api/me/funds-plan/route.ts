import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { FundsPlanSchema } from "@/schemas/rules/funds-plan-schema";
import {
  getFundsPlan,
  upsertFundsPlan,
} from "@/features/rules/services/funds-plan-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await getFundsPlan({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function PUT(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const plan = await validateJsonRequest(request, FundsPlanSchema);
    const result = await upsertFundsPlan({
      userId: user.id,
      plan,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
