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

export function getOptionalOpenRouterApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY ?? null;
}

export function getOpenRouterApiKey(): string {
  const key = getOptionalOpenRouterApiKey();
  if (!key) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }
  return key;
}
