import { describe, expect, it } from "vitest";
import { DocumentSummarySchema } from "@/schemas/documents/document-summary-schema";

describe("DocumentSummarySchema", () => {
  it("有効な要約をパースできる", () => {
    const result = DocumentSummarySchema.parse({
      summary: "Summary text",
      keyPoints: ["Point 1"],
      risks: ["Risk 1"],
      opportunities: ["Opp 1"],
      assumptions: ["Assumption 1"],
      questionsForRuleDesign: ["Q1"],
    });
    expect(result.summary).toBe("Summary text");
    expect(result.keyPoints).toHaveLength(1);
  });

  it("空配列を許容する", () => {
    const result = DocumentSummarySchema.parse({
      summary: "",
      keyPoints: [],
      risks: [],
      opportunities: [],
      assumptions: [],
      questionsForRuleDesign: [],
    });
    expect(result.keyPoints).toHaveLength(0);
  });
});
