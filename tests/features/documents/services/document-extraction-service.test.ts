import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "PDF text" }),
}));

const mockReadLocalStorageFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/local-file-storage", () => ({
  readLocalStorageFile: mockReadLocalStorageFile,
}));

import { createDatabaseClient } from "@/lib/db/database-client";
import { extractDocumentText } from "@/features/documents/services/document-extraction-service";

describe("extractDocumentText", () => {
  it("テキストファイルから本文を抽出する", async () => {
    const mockDatabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            id: "doc-1",
            mime_type: "text/plain",
            storage_path: "user-1/doc-1/test.txt",
            extracted_text: null,
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: "job-1" }, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    };

    mockReadLocalStorageFile.mockResolvedValue(Buffer.from("Hello world"));
    vi.mocked(createDatabaseClient).mockResolvedValue(mockDatabase as never);

    const result = await extractDocumentText({
      userId: "user-1",
      documentId: "doc-1",
    });

    expect(result.extractionStatus).toBe("extracted");
  });
});
