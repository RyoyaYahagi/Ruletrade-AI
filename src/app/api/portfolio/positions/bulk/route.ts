import { requireUser } from "@/lib/auth/require-user";
import { apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import {
  PortfolioPositionBulkSchema,
} from "@/schemas/portfolio/portfolio-position-schema";
import { createPortfolioPositions } from "@/features/portfolio/services/portfolio-position-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const input = await validateJsonRequest(request, PortfolioPositionBulkSchema);
    const result = await createPortfolioPositions({
      userId,
      positions: input.positions,
    });

    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/portfolio/positions/bulk",
      method: "POST",
    });
  }
}
