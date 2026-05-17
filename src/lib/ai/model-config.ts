import "server-only";

export type AIProviderKey =
  | "mock"
  | "openai"
  | "gemini"
  | "codex"
  | "codex-app-server";

export function getConfiguredAIProvider(): AIProviderKey {
  const provider = process.env.AI_PROVIDER;

  if (
    provider === "openai" ||
    provider === "gemini" ||
    provider === "codex" ||
    provider === "codex-app-server" ||
    provider === "mock"
  ) {
    return provider;
  }

  return "mock";
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export function getAITimeoutMs(): number {
  const raw = process.env.AI_TIMEOUT_MS;
  if (!raw) {
    return 30_000;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}
