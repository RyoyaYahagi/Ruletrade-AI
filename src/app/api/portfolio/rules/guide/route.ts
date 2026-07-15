import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { PortfolioRuleGuidanceRequestSchema } from "@/schemas/portfolio/portfolio-rule-guidance-schema";
import { guidePortfolioCommonRule } from "@/features/portfolio/services/portfolio-rule-guidance-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const input = await validateJsonRequest(
      request,
      PortfolioRuleGuidanceRequestSchema,
    );
    const result = await guidePortfolioCommonRule({
      userId: user.id,
      requestId,
      input,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/portfolio/rules/guide",
      method: "POST",
    });
  }
}
