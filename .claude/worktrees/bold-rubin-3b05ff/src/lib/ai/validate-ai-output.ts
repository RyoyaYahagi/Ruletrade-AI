import { z } from "zod";

export type ValidateAiOutputResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        message: string;
        issues: z.ZodIssue[];
      };
    };

export function validateAiOutput<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): ValidateAiOutputResult<z.infer<TSchema>> {
  const result = schema.safeParse(value);

  if (!result.success) {
    return {
      ok: false,
      error: {
        message: "AI output does not match the expected schema.",
        issues: result.error.issues,
      },
    };
  }

  return {
    ok: true,
    data: result.data,
  };
}

