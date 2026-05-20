import type { EmbeddingProviderKey } from "@/lib/ai/embeddings/embedding-provider";

export function getConfiguredEmbeddingProvider(): EmbeddingProviderKey {
  const env = process.env.EMBEDDING_PROVIDER;

  if (env === "openai" || env === "gemini") {
    return env;
  }

  return "mock";
}

export function getOpenAIEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}

export function getGeminiEmbeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
}

export function getEmbeddingDimensions(): number {
  return Number(process.env.EMBEDDING_DIMENSIONS ?? 1536);
}
