import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { getWatchlist } from "@/features/watchlist/services/watchlist-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await getWatchlist({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
