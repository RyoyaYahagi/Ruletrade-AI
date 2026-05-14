import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";

export async function validateJsonRequest<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let json: unknown;

  try {
    json = await request.json();
  } catch {
    throw new AppError(
      "VALIDATION_ERROR",
      "Request body must be valid JSON.",
      400,
    );
  }

  const result = schema.safeParse(json);

  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "入力内容を確認してください。",
      400,
      result.error.flatten(),
    );
  }

  return result.data;
}

