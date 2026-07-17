import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createRuleSessionFromPortfolioPosition } from "@/features/portfolio/services/portfolio-to-rule-session-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const { positionId } = await params;

    const result = await createRuleSessionFromPortfolioPosition({
      userId: user.id,
      positionId,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/portfolio/positions/[positionId]/create-rule-session",
      method: "POST",
    });
  }
}
