import "server-only";

import type {
  CreateEmbeddingParams,
  CreateEmbeddingResult,
  EmbeddingProvider,
} from "@/lib/ai/embeddings/embedding-provider";
import {
  getEmbeddingDimensions,
  getGeminiEmbeddingModel,
} from "@/lib/ai/embeddings/embedding-config";
import { AIProviderError } from "@/lib/ai/ai-provider-error";

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new AIProviderError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "GEMINI_API_KEY is not set.",
        undefined,
        false,
      );
    }

    this.apiKey = apiKey;
  }

  async createEmbeddings(
    params: CreateEmbeddingParams,
  ): Promise<CreateEmbeddingResult> {
    const model = getGeminiEmbeddingModel();
    const dimensions = getEmbeddingDimensions();

    const inputs = Array.isArray(params.input) ? params.input : [params.input];

    const embeddings: number[][] = [];

    for (const input of inputs) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: {
              parts: [{ text: input }],
            },
            config: {
              outputDimensionality: dimensions,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new AIProviderError(
          "AI_PROVIDER_REQUEST_FAILED",
          `Gemini embedding API failed: ${response.status} ${errorText}`,
          undefined,
          true,
        );
      }

      const data = (await response.json()) as {
        embedding?: {
          values?: number[];
        };
      };

      embeddings.push(data.embedding?.values ?? []);
    }

    return {
      embeddings,
      provider: "gemini",
      model,
      dimensions,
      usage: {
        inputTokens: undefined,
        estimatedCostUsd: undefined,
      },
    };
  }
}
