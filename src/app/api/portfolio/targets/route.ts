import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import {
  listTargets,
  upsertTarget,
} from "@/features/portfolio/services/portfolio-target-service";
import { PortfolioTargetInputSchema } from "@/schemas/portfolio/portfolio-target-schema";
import { getOrCreateMainPortfolio } from "@/features/portfolio/services/portfolio-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const requestedPortfolioId = new URL(request.url).searchParams.get("portfolioId");
    const { portfolio } = requestedPortfolioId
      ? { portfolio: { id: requestedPortfolioId } }
      : await getOrCreateMainPortfolio({ userId: user.id });
    return apiSuccess(await listTargets({ userId: user.id, portfolioId: portfolio.id }));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/portfolio/targets", method: "GET" });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, PortfolioTargetInputSchema);
    return apiSuccess(
      await upsertTarget({
        userId: user.id,
        portfolioId: input.portfolioId,
        targetType: input.targetType,
        targetKey: input.targetKey,
        targetPercent: input.targetPercent,
        tolerancePercent: input.tolerancePercent,
      }),
    );
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/portfolio/targets", method: "POST" });
  }
}
