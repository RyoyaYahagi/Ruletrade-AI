import { beforeEach, describe, expect, it, vi } from "vitest";

import { retrieveRagContext } from "@/features/rag/services/retrieve-rag-context";

const mockInsert = vi.fn();
const mockQueryResult = vi.fn();
const mockCreateEmbeddings = vi.fn();

function createAwaitableQuery(result: unknown | (() => unknown)) {
  const resolveResult = () =>
    typeof result === "function" ? result() : result;
  return {
    in: vi.fn(() => createAwaitableQuery(result)),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(resolveResult()).then(resolve, reject),
  };
}

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "rag_chunks") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => createAwaitableQuery(() => mockQueryResult())),
          })),
        };
      }
      return { insert: mockInsert };
    }),
  })),
}));

vi.mock("@/lib/ai/embeddings/embedding-provider-factory", () => ({
  getEmbeddingProvider: vi.fn(() => ({
    createEmbeddings: mockCreateEmbeddings,
  })),
}));

describe("retrieveRagContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateEmbeddings.mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
      provider: "mock",
      model: "mock-embedding-model",
    });
    mockInsert.mockResolvedValue({ data: null, error: null });
  });

  it("returns empty context when SQLite has no matching chunks", async () => {
    mockQueryResult.mockReturnValueOnce({ data: [], error: null });

    await expect(
      retrieveRagContext({
        userId: "guest-user",
        taskType: "rule_review",
        queryText: "review this rule",
      }),
    ).resolves.toEqual({
      chunks: [],
      contextText: "",
    });

    expect(mockInsert).toHaveBeenCalled();
  });

  it("throws SQLite query errors", async () => {
    mockQueryResult.mockReturnValueOnce({
      data: null,
      error: { message: "failed" },
    });

    await expect(
      retrieveRagContext({
        userId: "guest-user",
        taskType: "rule_review",
        queryText: "review this rule",
      }),
    ).rejects.toMatchObject({ message: "failed" });
  });
});
