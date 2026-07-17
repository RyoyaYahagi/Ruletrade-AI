import { describe, expect, it } from "vitest";
import {
  UserDocumentSchema,
  DocumentTypeSchema,
} from "@/schemas/documents/document-schema";

describe("DocumentTypeSchema", () => {
  it("有効な種別をパースできる", () => {
    expect(DocumentTypeSchema.parse("research_note")).toBe("research_note");
  });

  it("無効な種別を拒否する", () => {
    expect(() => DocumentTypeSchema.parse("invalid")).toThrow();
  });
});

describe("UserDocumentSchema", () => {
  it("有効な資料をパースできる", () => {
    const result = UserDocumentSchema.parse({
      title: "Test Document",
      originalFilename: "test.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
      documentType: "earnings_material",
    });
    expect(result.title).toBe("Test Document");
    expect(result.fileSizeBytes).toBe(1024);
  });

  it("空タイトルを拒否する", () => {
    expect(() =>
      UserDocumentSchema.parse({
        title: "",
        originalFilename: "test.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 1024,
      }),
    ).toThrow();
  });

  it("10MB超を拒否する", () => {
    expect(() =>
      UserDocumentSchema.parse({
        title: "Test",
        originalFilename: "test.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 10 * 1024 * 1024 + 1,
      }),
    ).toThrow();
  });

  it("不正なMIMEを拒否する", () => {
    expect(() =>
      UserDocumentSchema.parse({
        title: "Test",
        originalFilename: "test.exe",
        mimeType: "application/octet-stream",
        fileSizeBytes: 1024,
      }),
    ).toThrow();
  });

  it("決算資料では銘柄コードと会計期間を必須にする", () => {
    const base = {
      title: "決算資料",
      originalFilename: "earnings.pdf",
      mimeType: "application/pdf" as const,
      fileSizeBytes: 1024,
      documentKind: "earnings_report" as const,
    };

    expect(() => UserDocumentSchema.parse(base)).toThrow();
    expect(() =>
      UserDocumentSchema.parse({ ...base, ticker: "7203" }),
    ).toThrow();
    expect(
      UserDocumentSchema.parse({
        ...base,
        ticker: "7203",
        fiscalPeriod: "FY2026Q1",
      }),
    ).toMatchObject({ documentKind: "earnings_report", fiscalPeriod: "FY2026Q1" });
  });

  it("メモは銘柄コードと会計期間なしで保存できる", () => {
    expect(
      UserDocumentSchema.parse({
        title: "判断メモ",
        originalFilename: "note.md",
        mimeType: "text/markdown",
        fileSizeBytes: 10,
        documentKind: "note",
      }),
    ).toMatchObject({ documentKind: "note" });
  });
});
