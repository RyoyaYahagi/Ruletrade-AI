import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { PortfolioCommonRuleSchema } from "@/schemas/portfolio/portfolio-rule-schema";
import {
  getPortfolioCommonRule,
  upsertPortfolioCommonRule,
} from "@/features/portfolio/services/portfolio-rule-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await getPortfolioCommonRule({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function PUT(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const rule = await validateJsonRequest(request, PortfolioCommonRuleSchema);
    const result = await upsertPortfolioCommonRule({
      userId: user.id,
      rule,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
