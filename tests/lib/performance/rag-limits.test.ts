import { describe, expect, test } from "vitest";
import { RAG_LIMITS } from "@/lib/performance/rag-limits";

describe("RAG_LIMITS", () => {
  test("defaultTopK is within max", () => {
    expect(RAG_LIMITS.defaultTopK).toBeLessThanOrEqual(RAG_LIMITS.maxTopK);
  });

  test("defaultMaxContextChars is within max", () => {
    expect(RAG_LIMITS.defaultMaxContextChars).toBeLessThanOrEqual(
      RAG_LIMITS.maxMaxContextChars,
    );
  });
});
