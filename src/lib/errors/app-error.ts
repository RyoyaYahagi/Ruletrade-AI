export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown,
    public retryable = false
  ) {
    super(message);
    this.name = "AppError";
  }
}
