import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/ai/embeddings/embedding-provider-factory", () => ({
  getEmbeddingProvider: vi.fn(),
}));

import { createServerClient } from "@/lib/db/supabase-server";
import { uploadDocument } from "@/features/documents/services/document-upload-service";

describe("uploadDocument", () => {
  it("StorageとDBに保存する", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: "doc-1" }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
    };

    vi.mocked(createServerClient).mockResolvedValue(mockSupabase as never);

    const result = await uploadDocument({
      userId: "user-1",
      file: Buffer.from("test"),
      title: "Test",
      originalFilename: "test.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
      documentType: "other",
    });

    expect(result.documentId).toBe("doc-1");
    expect(mockSupabase.storage.from).toHaveBeenCalledWith("documents");
  });
});
