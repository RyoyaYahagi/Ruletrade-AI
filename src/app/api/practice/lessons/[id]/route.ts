import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  getLessonProgress,
  updateLessonProgress,
  markLessonCompleted,
  deleteLessonProgress,
} from "@/features/education/services/lesson-progress-service";

const UpdateLessonProgressRequestSchema = z.object({
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  completion_percent: z.number().int().min(0).max(100).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    // id is the lesson_id (not the progress record id) for the GET endpoint
    const result = await getLessonProgress(user.id, id);
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

    // Check for mark-completed intent via query param
    const url = new URL(request.url);
    if (url.searchParams.get("action") === "complete") {
      const result = await markLessonCompleted(id, user.id);
      return apiSuccess(result);
    }

    const input = await validateJsonRequest(
      request,
      UpdateLessonProgressRequestSchema,
    );
    const result = await updateLessonProgress({
      progressId: id,
      userId: user.id,
      ...input,
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
    await deleteLessonProgress(id, user.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
