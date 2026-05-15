import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  listPortfolioPositions,
  createPortfolioPosition,
} from "@/features/portfolio/services/portfolio-position-service";
import { PortfolioPositionSchema } from "@/schemas/portfolio/portfolio-position-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await listPortfolioPositions({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, PortfolioPositionSchema);
    const result = await createPortfolioPosition({
      userId: user.id,
      ...input,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
