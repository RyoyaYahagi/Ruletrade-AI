import "server-only";

import OpenAI from "openai";
import type {
  CreateEmbeddingParams,
  CreateEmbeddingResult,
  EmbeddingProvider,
} from "@/lib/ai/embeddings/embedding-provider";
import {
  getEmbeddingDimensions,
  getOpenAIEmbeddingModel,
} from "@/lib/ai/embeddings/embedding-config";
import { AIProviderError } from "@/lib/ai/ai-provider-error";

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new AIProviderError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "OPENAI_API_KEY is not set.",
        undefined,
        false,
      );
    }

    this.client = new OpenAI({
      apiKey,
    });
  }

  async createEmbeddings(
    params: CreateEmbeddingParams,
  ): Promise<CreateEmbeddingResult> {
    const model = getOpenAIEmbeddingModel();
    const dimensions = getEmbeddingDimensions();

    const response = await this.client.embeddings.create({
      model,
      input: params.input,
      dimensions,
    });

    return {
      embeddings: response.data.map((item) => item.embedding),
      provider: "openai",
      model,
      dimensions,
      usage: {
        inputTokens: response.usage?.total_tokens,
      },
    };
  }
}
