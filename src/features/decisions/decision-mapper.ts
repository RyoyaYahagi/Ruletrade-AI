import { DecisionSchema, DecisionTypeSchema } from "@/schemas/decision";
import { OriginSchema } from "@/schemas/origin";
import type { stocks } from "@/lib/db/schema";

import type { Decision } from "@/schemas/decision";

type DecisionRow = {
  id: string;
  stockId: string;
  type: string;
  rawInput: string;
  transcript: string | null;
  followUpAnswer: string | null;
  followUpQuestion?: string | null;
  summary?: string | null;
  points?: string | null;
  thesis: string | null;
  assumptions: string;
  reviewConditions: string;
  addConditions: string;
  reviewAt: string | null;
  reviewDates?: string | null;
  editHistory?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  origin?: string | null;
};

export function mapDecisionRow(row: DecisionRow): Decision {
  return {
    ...row,
    followUpQuestion: row.followUpQuestion ?? null,
    summary: row.summary ?? row.thesis,
    points: row.points == null ? [] : parsePoints(row.points),
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
    origin: OriginSchema.parse(row.origin ?? "web"),
  };
}

export function mapStockRow(row: typeof stocks.$inferSelect) {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    market: row.market,
    createdAt: row.createdAt,
  };
}

function parsePoints(value: string) {
  const decoded: unknown = JSON.parse(value);
  if (!Array.isArray(decoded)) throw new Error("Stored decision points are invalid");
  return decoded;
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
