import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/rag/chunk-text";

describe("chunkText", () => {
  it("短いテキストはそのまま1つのchunkにする", () => {
    const result = chunkText({ text: "hello world", maxChars: 100 });
    expect(result).toEqual(["hello world"]);
  });

  it("長いテキストを複数のchunkに分割する", () => {
    const text = "a".repeat(2500);
    const result = chunkText({ text, maxChars: 1000, overlapChars: 100 });
    expect(result.length).toBeGreaterThan(1);
  });

  it("overlapを作る", () => {
    const text = "a".repeat(2500);
    const result = chunkText({ text, maxChars: 1000, overlapChars: 100 });
    // 2番目のchunkの先頭部分が1番目のchunkの末尾部分と重なる
    expect(result[0].slice(-50)).toBe(result[1].slice(0, 50));
  });

  it("空文字列は空配列を返す", () => {
    const result = chunkText({ text: "" });
    expect(result).toEqual([]);
  });

  it("trim後にmaxCharsを下回る場合は1つのchunk", () => {
    const result = chunkText({ text: "  hello  ", maxChars: 100 });
    expect(result).toEqual(["hello"]);
  });
});
