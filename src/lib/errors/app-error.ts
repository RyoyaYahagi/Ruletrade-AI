import type { ErrorCode } from "@/lib/errors/error-codes";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: unknown,
    public retryable = false,
  ) {
    super(message);
    this.name = "AppError";
  }
}
