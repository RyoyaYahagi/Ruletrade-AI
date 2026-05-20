import { describe, expect, it } from "vitest";
import { MockEmbeddingProvider } from "@/lib/ai/embeddings/providers/mock-embedding-provider";

describe("MockEmbeddingProvider", () => {
  it("1536次元のベクトルを返す", async () => {
    const provider = new MockEmbeddingProvider();
    const result = await provider.createEmbeddings({
      input: "test",
    });

    expect(result.embeddings).toHaveLength(1);
    expect(result.embeddings[0]).toHaveLength(1536);
    expect(result.dimensions).toBe(1536);
  });

  it("複数inputに対して複数のembeddingを返す", async () => {
    const provider = new MockEmbeddingProvider();
    const result = await provider.createEmbeddings({
      input: ["test1", "test2"],
    });

    expect(result.embeddings).toHaveLength(2);
    expect(result.embeddings[0]).toHaveLength(1536);
    expect(result.embeddings[1]).toHaveLength(1536);
  });

  it("同じinputは同じembeddingを返す", async () => {
    const provider = new MockEmbeddingProvider();
    const result1 = await provider.createEmbeddings({
      input: "same text",
    });
    const result2 = await provider.createEmbeddings({
      input: "same text",
    });

    expect(result1.embeddings[0]).toEqual(result2.embeddings[0]);
  });

  it("正規化されている（ノルムが1に近い）", async () => {
    const provider = new MockEmbeddingProvider();
    const result = await provider.createEmbeddings({
      input: "test",
    });

    const vector = result.embeddings[0];
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

    expect(norm).toBeCloseTo(1, 5);
  });

  it("providerとmodelが正しい", async () => {
    const provider = new MockEmbeddingProvider();
    const result = await provider.createEmbeddings({
      input: "test",
    });

    expect(result.provider).toBe("mock");
    expect(result.model).toBe("mock-embedding-model");
  });
});
