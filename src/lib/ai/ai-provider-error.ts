export type AIProviderErrorCode =
  | "AI_PROVIDER_NOT_CONFIGURED"
  | "AI_PROVIDER_REQUEST_FAILED"
  | "AI_PROVIDER_TIMEOUT"
  | "AI_PROVIDER_RATE_LIMITED"
  | "AI_PROVIDER_QUOTA_EXCEEDED"
  | "AI_OUTPUT_PARSE_FAILED"
  | "AI_OUTPUT_SCHEMA_INVALID"
  | "AI_UNKNOWN_ERROR";

export class AIProviderError extends Error {
  constructor(
    public code: AIProviderErrorCode,
    message: string,
    public details?: unknown,
    public retryable = false
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
