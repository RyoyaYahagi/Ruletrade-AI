import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { CreateFeedbackSchema } from "@/schemas/analytics/feedback-schema";
import {
  createFeedback,
  listFeedback,
} from "@/features/analytics/services/feedback-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await listFeedback({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/feedback",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = CreateFeedbackSchema.parse(body);
    const result = await createFeedback({ userId: user.id, ...input });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/feedback",
      method: "POST",
    });
  }
}
