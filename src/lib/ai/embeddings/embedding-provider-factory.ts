import "server-only";

import type { EmbeddingProvider } from "@/lib/ai/embeddings/embedding-provider";
import { getConfiguredEmbeddingProvider } from "@/lib/ai/embeddings/embedding-config";
import { MockEmbeddingProvider } from "@/lib/ai/embeddings/providers/mock-embedding-provider";
import { OpenAIEmbeddingProvider } from "@/lib/ai/embeddings/providers/openai-embedding-provider";
import { GeminiEmbeddingProvider } from "@/lib/ai/embeddings/providers/gemini-embedding-provider";

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = getConfiguredEmbeddingProvider();

  switch (provider) {
    case "openai":
      return new OpenAIEmbeddingProvider();

    case "gemini":
      return new GeminiEmbeddingProvider();

    case "mock":
    default:
      return new MockEmbeddingProvider();
  }
}
