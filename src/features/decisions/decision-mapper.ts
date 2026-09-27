import { DecisionSchema, DecisionTypeSchema } from "@/schemas/decision";

import type { Decision, DecisionExtraction } from "@/schemas/decision";

type DecisionRow = {
  id: string;
  stockId: string;
  type: string;
  rawInput: string;
  transcript: string | null;
  followUpAnswer: string | null;
  thesis: string | null;
  assumptions: string;
  reviewConditions: string;
  addConditions: string;
  reviewAt: string | null;
  reviewDates?: string | null;
  editHistory?: string | null;
  decidedAt?: string | null;
  createdAt: string;
};

export function mapDecisionRow(row: DecisionRow): Decision {
  return {
    ...row,
    type: DecisionTypeSchema.parse(row.type),
    editHistory: DecisionSchema.shape.editHistory.parse(
      row.editHistory == null ? [] : JSON.parse(row.editHistory),
    ),
    reviewDates:
      row.reviewDates == null
        ? row.reviewAt
          ? [row.reviewAt]
          : []
        : parseStringArray(row.reviewDates),
    assumptions: parseStringArray(row.assumptions),
    reviewConditions: parseStringArray(row.reviewConditions),
    addConditions: parseStringArray(row.addConditions),
  };
}

export function mapExtractionToDecisionFields(extraction: DecisionExtraction) {
  return {
    type: extraction.type,
    thesis: extraction.thesis,
    assumptions: extraction.assumptions,
    reviewConditions: extraction.reviewConditions,
    addConditions: extraction.addConditions,
  };
}

function parseStringArray(value: string): string[] {
  const decoded: unknown = JSON.parse(value);
  if (
    !Array.isArray(decoded) ||
    decoded.some((item) => typeof item !== "string")
  ) {
    throw new Error("Stored decision list field is invalid");
  }
  return decoded;
}
