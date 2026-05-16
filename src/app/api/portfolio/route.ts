import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  getPortfolio,
  getOrCreateMainPortfolio,
} from "@/features/portfolio/services/portfolio-service";
import { PortfolioSchema } from "@/schemas/portfolio/portfolio-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await getPortfolio({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    await validateJsonRequest(request, PortfolioSchema);
    const { portfolio } = await getOrCreateMainPortfolio({
      userId: user.id,
    });
    // MVP: portfolio は getOrCreateMainPortfolio で自動作成される
    return apiSuccess({ portfolio });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
