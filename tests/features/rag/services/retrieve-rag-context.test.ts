import { beforeEach, describe, expect, it, vi } from "vitest";

import { retrieveRagContext } from "@/features/rag/services/retrieve-rag-context";

const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockCreateEmbeddings = vi.fn();

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
    rpc: mockRpc,
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

  it("returns empty context when local SQLite RPC is unsupported", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "SQLITE_UNSUPPORTED",
        message: "Supabase RPC is not available with SQLite",
      },
    });

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

    expect(mockRpc).toHaveBeenCalledWith("match_rag_chunks", expect.any(Object));
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("throws other RAG RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "DATABASE_ERROR",
        message: "failed",
      },
    });

    await expect(
      retrieveRagContext({
        userId: "guest-user",
        taskType: "rule_review",
        queryText: "review this rule",
      }),
    ).rejects.toMatchObject({
      code: "DATABASE_ERROR",
      message: "failed",
    });
  });
});
