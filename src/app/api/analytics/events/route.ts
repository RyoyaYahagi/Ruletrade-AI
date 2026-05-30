import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { TrackProductEventSchema } from "@/schemas/analytics/product-event-schema";
import { trackProductEvent } from "@/features/analytics/services/product-event-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = TrackProductEventSchema.parse(body);

    await trackProductEvent({
      userId: user.id,
      eventName: input.eventName,
      properties: input.properties,
      sessionId: input.sessionId,
    });

    return apiSuccess({ tracked: true });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/analytics/events",
      method: "POST",
    });
  }
}
