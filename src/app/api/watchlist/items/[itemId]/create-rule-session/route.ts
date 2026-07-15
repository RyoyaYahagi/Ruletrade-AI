import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createRuleSessionFromWatchlistItem } from "@/features/watchlist/services/watchlist-to-rule-session-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const { itemId } = await params;

    const result = await createRuleSessionFromWatchlistItem({
      userId: user.id,
      itemId,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/watchlist/items/[itemId]/create-rule-session",
      method: "POST",
    });
  }
}
