import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  createPracticeSession,
  listUserPracticeSessions,
} from "@/features/education/services/practice-session-service";

const CreateSessionRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  virtual_balance: z.number().min(0).optional(),
  starting_balance: z.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  lesson_plan: z.string().max(2000).nullable().optional(),
  target_duration_days: z.number().int().min(1).max(365).nullable().optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(
      request,
      CreateSessionRequestSchema,
    );
    const result = await createPracticeSession({ user_id: user.id, ...input });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined;

    const result = await listUserPracticeSessions({
      userId: user.id,
      status: status as any,
      limit,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
