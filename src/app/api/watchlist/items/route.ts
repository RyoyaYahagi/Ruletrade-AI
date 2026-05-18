import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  listWatchlistItems,
  createWatchlistItem,
} from "@/features/watchlist/services/watchlist-item-service";
import { WatchlistItemSchema } from "@/schemas/watchlist/watchlist-item-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await listWatchlistItems({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, WatchlistItemSchema);
    const result = await createWatchlistItem({ userId: user.id, ...input });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
