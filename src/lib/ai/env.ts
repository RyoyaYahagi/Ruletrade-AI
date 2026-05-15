import "server-only";

export function getOptionalOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

export function getOpenAiApiKey(): string {
  const key = getOptionalOpenAiApiKey();
  if (!key) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }
  return key;
}

export function getOptionalAnthropicApiKey(): string | null {
  // TODO: 将来の Claude 対応用 — 現在未使用
  return process.env.ANTHROPIC_API_KEY ?? null;
}

export function getOptionalGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? null;
}

export function getGeminiApiKey(): string {
  const key = getOptionalGeminiApiKey();
  if (!key) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  return key;
}
