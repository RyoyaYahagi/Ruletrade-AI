import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const upsertRagDocument = vi.hoisted(() => vi.fn());
vi.mock("@/features/rag/services/upsert-rag-document", () => ({
  upsertRagDocument,
}));

describe("document index service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    vi.clearAllMocks();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("決算資料をearnings_reportとして索引する", async () => {
    const { service, client } = await loadService();
    await client.from("user_documents").insert({
      id: "earnings-old",
      user_id: "user-a",
      title: "FY2025",
      document_type: "earnings_material",
      document_kind: "earnings_report",
      fiscal_period: "FY2025",
      ticker: "7203",
      extracted_text: "売上の事実",
    });
    upsertRagDocument.mockResolvedValue({ documentId: "rag-1", skipped: false });

    await service.indexDocumentForRag({ userId: "user-a", documentId: "earnings-old" });

    expect(upsertRagDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-a",
        sourceType: "earnings_report",
        sourceId: "earnings-old",
        metadata: expect.objectContaining({ fiscalPeriod: "FY2025" }),
      }),
    );
  });

  it("新しい期の索引で古い期のRAGを削除し、所有者以外の資料は対象にしない", async () => {
    const { service, client } = await loadService();
    await client.from("user_documents").insert([
      {
        id: "user-a-old",
        user_id: "user-a",
        title: "A old",
        document_type: "earnings_material",
        document_kind: "earnings_report",
        fiscal_period: "FY2025",
        ticker: "7203",
        extracted_text: "A old",
      },
      {
        id: "user-a-new",
        user_id: "user-a",
        title: "A new",
        document_type: "earnings_material",
        document_kind: "earnings_report",
        fiscal_period: "FY2026Q1",
        ticker: "7203",
        extracted_text: "A new",
      },
      {
        id: "user-b-new",
        user_id: "user-b",
        title: "B new",
        document_type: "earnings_material",
        document_kind: "earnings_report",
        fiscal_period: "FY2027",
        ticker: "7203",
        extracted_text: "B new",
      },
    ]);
    await client.from("rag_documents").insert({
      id: "rag-old",
      user_id: "user-a",
      source_type: "earnings_report",
      source_id: "user-a-old",
      title: "A old",
    });
    await client.from("rag_chunks").insert({
      id: "chunk-old",
      user_id: "user-a",
      source_type: "earnings_report",
      source_id: "user-a-old",
      document_id: "rag-old",
      content: "A old",
    });
    upsertRagDocument.mockResolvedValue({ documentId: "rag-new", skipped: false });

    await service.indexDocumentForRag({ userId: "user-a", documentId: "user-a-new" });

    const oldDocs = await client
      .from("rag_documents")
      .select("id")
      .eq("user_id", "user-a")
      .eq("source_id", "user-a-old");
    const oldChunks = await client
      .from("rag_chunks")
      .select("id")
      .eq("user_id", "user-a")
      .eq("source_id", "user-a-old");
    expect(oldDocs.data).toEqual([]);
    expect(oldChunks.data).toEqual([]);

    await service.indexDocumentForRag({ userId: "user-b", documentId: "user-b-new" });
    expect(upsertRagDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: "user-b", sourceType: "earnings_report" }),
    );
  });

  async function loadService() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-document-index-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    const service = await import("@/features/documents/services/document-index-service");
    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    return { service, client: createSqliteClient() };
  }
});
