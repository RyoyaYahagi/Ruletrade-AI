import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  createLessonProgress,
  listUserLessonProgress,
  upsertLessonProgress,
} from "@/features/education/services/lesson-progress-service";
import type {
  LessonCategory,
  LessonStatus,
} from "@/schemas/education/practice-mode-schema";

const CreateLessonProgressRequestSchema = z.object({
  lesson_id: z.string().min(1).max(200),
  lesson_title: z.string().min(1).max(500),
  lesson_category: z.enum(["basics", "rules", "risk", "review", "portfolio"]),
});

const UpsertLessonProgressRequestSchema = z.object({
  lesson_id: z.string().min(1).max(200),
  lesson_title: z.string().min(1).max(500),
  lesson_category: z.enum(["basics", "rules", "risk", "review", "portfolio"]),
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  completion_percent: z.number().int().min(0).max(100).optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();

    // Check if upsert is requested via query param
    const url = new URL(request.url);
    const upsert = url.searchParams.get("upsert") === "true";

    if (upsert) {
      const input = await validateJsonRequest(
        request,
        UpsertLessonProgressRequestSchema,
      );
      const result = await upsertLessonProgress({
        user_id: user.id,
        ...input,
      });
      return apiCreated(result);
    }

    const input = await validateJsonRequest(
      request,
      CreateLessonProgressRequestSchema,
    );
    const result = await createLessonProgress({
      user_id: user.id,
      ...input,
    });
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
    const lessonCategory = url.searchParams.get("lesson_category") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined;

    const result = await listUserLessonProgress({
      userId: user.id,
      lesson_category: lessonCategory as LessonCategory | undefined,
      status: status as LessonStatus | undefined,
      limit,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
