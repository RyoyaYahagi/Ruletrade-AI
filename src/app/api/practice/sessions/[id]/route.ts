import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  getPracticeSessionById,
  updatePracticeSession,
  updatePracticeSessionStatus,
  deletePracticeSession,
} from "@/features/education/services/practice-session-service";

const PatchSessionRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  virtual_balance: z.number().min(0).optional(),
  lesson_plan: z.string().max(2000).nullable().optional(),
  target_duration_days: z.number().int().min(1).max(365).nullable().optional(),
  status: z.enum(["active", "paused", "completed", "abandoned"]).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await getPracticeSessionById(id, user.id);
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await validateJsonRequest(request, PatchSessionRequestSchema);

    if (input.status !== undefined) {
      const result = await updatePracticeSessionStatus({
        sessionId: id,
        userId: user.id,
        status: input.status,
      });
      return apiSuccess(result);
    }

    const { status: _, ...updateFields } = input;
    const result = await updatePracticeSession({
      sessionId: id,
      userId: user.id,
      ...updateFields,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    await deletePracticeSession(id, user.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
