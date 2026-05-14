import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "AI_PROVIDER_ERROR",
  "AI_OUTPUT_INVALID",
  "SAFETY_FAILED",
  "RATE_LIMITED",
  "COST_LIMIT_EXCEEDED",
  "PROCESSING_FAILED",
  "FEATURE_DISABLED",
  "INTERNAL_ERROR",
]);

export const ApiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
    retryable: z.boolean().optional(),
  }),
});

export const createApiSuccessResponseSchema = <T extends z.ZodType>(
  dataSchema: T
) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
