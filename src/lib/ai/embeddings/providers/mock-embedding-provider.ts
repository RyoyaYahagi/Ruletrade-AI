import type {
  CreateEmbeddingParams,
  CreateEmbeddingResult,
  EmbeddingProvider,
} from "@/lib/ai/embeddings/embedding-provider";

export class MockEmbeddingProvider implements EmbeddingProvider {
  async createEmbeddings(
    params: CreateEmbeddingParams,
  ): Promise<CreateEmbeddingResult> {
    const inputs = Array.isArray(params.input) ? params.input : [params.input];

    return {
      embeddings: inputs.map((input) => createDeterministicVector(input, 1536)),
      provider: "mock",
      model: "mock-embedding-model",
      dimensions: 1536,
      usage: {
        inputTokens: 0,
        estimatedCostUsd: 0,
      },
    };
  }
}

function createDeterministicVector(input: string, dimensions: number) {
  const values: number[] = [];

  let seed = 0;

  for (let index = 0; index < input.length; index += 1) {
    seed = (seed + input.charCodeAt(index) * 31) % 9973;
  }

  for (let index = 0; index < dimensions; index += 1) {
    const value = Math.sin(seed + index) * 0.5 + 0.5;
    values.push(Number(value.toFixed(8)));
  }

  return normalizeVector(values);
}

function normalizeVector(values: number[]) {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    return values;
  }

  return values.map((value) => Number((value / norm).toFixed(8)));
}
