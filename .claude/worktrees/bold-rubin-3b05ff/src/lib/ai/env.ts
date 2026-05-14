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
  return process.env.ANTHROPIC_API_KEY ?? null;
}

export function getAnthropicApiKey(): string {
  const key = getOptionalAnthropicApiKey();
  if (!key) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable");
  }
  return key;
}
