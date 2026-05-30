export type EmbeddingProviderKey = "mock" | "openai" | "gemini";

export type CreateEmbeddingParams = {
  input: string | string[];
  taskType?:
    | "semantic_similarity"
    | "retrieval_query"
    | "retrieval_document"
    | "classification"
    | "clustering";
};

export type CreateEmbeddingResult = {
  embeddings: number[][];
  provider: EmbeddingProviderKey;
  model: string;
  dimensions: number;
  usage?: {
    inputTokens?: number;
    estimatedCostUsd?: number;
  };
};

export interface EmbeddingProvider {
  createEmbeddings(
    params: CreateEmbeddingParams,
  ): Promise<CreateEmbeddingResult>;
}
