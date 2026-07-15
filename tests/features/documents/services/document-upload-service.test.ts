import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

vi.mock("@/lib/ai/embeddings/embedding-provider-factory", () => ({
  getEmbeddingProvider: vi.fn(),
}));

const mockWriteLocalStorageFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/local-file-storage", () => ({
  writeLocalStorageFile: mockWriteLocalStorageFile,
}));

import { createDatabaseClient } from "@/lib/db/database-client";
import { uploadDocument } from "@/features/documents/services/document-upload-service";

describe("uploadDocument", () => {
  it("ローカルファイルとDBに保存する", async () => {
    const mockDatabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: "doc-1" }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    };

    mockWriteLocalStorageFile.mockResolvedValueOnce(undefined);
    vi.mocked(createDatabaseClient).mockResolvedValue(mockDatabase as never);

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
    expect(mockWriteLocalStorageFile).toHaveBeenCalledWith({
      bucket: "documents",
      storagePath: "user-1/doc-1/test.pdf",
      data: Buffer.from("test"),
    });
  });
});
