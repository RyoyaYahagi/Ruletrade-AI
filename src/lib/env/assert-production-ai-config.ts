import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { assertCodexAppServerLocalOnly } from "@/lib/ai/codex-app-server-access";

export function assertProductionAiConfig() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const provider = process.env.AI_PROVIDER;

  if (provider === "mock") {
    throw new AppError(
      "INTERNAL_ERROR",
      "AI_PROVIDER must not be mock in production.",
      500,
    );
  }

  if (provider === "codex-app-server") {
    assertCodexAppServerLocalOnly();
  }

  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new AppError(
      "INTERNAL_ERROR",
      "OPENAI_API_KEY is required in production.",
      500,
    );
  }

  if (provider === "gemini" && !process.env.GEMINI_API_KEY) {
    throw new AppError(
      "INTERNAL_ERROR",
      "GEMINI_API_KEY is required in production.",
      500,
    );
  }
}
