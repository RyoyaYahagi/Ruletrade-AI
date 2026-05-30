import { describe, expect, it } from "vitest";
import { hashContent } from "@/lib/rag/hash-content";

describe("hashContent", () => {
  it("同じ文字列は同じhashを返す", () => {
    const hash1 = hashContent("test");
    const hash2 = hashContent("test");
    expect(hash1).toBe(hash2);
  });

  it("違う文字列は違うhashを返す", () => {
    const hash1 = hashContent("test1");
    const hash2 = hashContent("test2");
    expect(hash1).not.toBe(hash2);
  });

  it("64文字のhex文字列を返す", () => {
    const hash = hashContent("test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
