import { describe, expect, it } from "vitest";
import {
  DataDeletionRequestSchema,
  DataDeletionTypeSchema,
} from "@/schemas/privacy/data-deletion-schema";

describe("DataDeletionTypeSchema", () => {
  it("accepts valid types", () => {
    expect(DataDeletionTypeSchema.safeParse("rag_memory").success).toBe(true);
    expect(DataDeletionTypeSchema.safeParse("account").success).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(DataDeletionTypeSchema.safeParse("invalid").success).toBe(false);
  });
});

describe("DataDeletionRequestSchema", () => {
  it("parses valid account deletion", () => {
    const result = DataDeletionRequestSchema.safeParse({
      deletionType: "account",
      confirmText: "DELETE",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid targetId", () => {
    const result = DataDeletionRequestSchema.safeParse({
      deletionType: "document",
      targetId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
