import type { Decision } from "@/schemas/decision";
import { decisionDisplayText } from "@/features/decisions/decision-display";

export function buildComparisonContext(decisions: Decision[]) {
  return decisions.map((decision) => ({
    id: decision.id,
    createdAt: decision.createdAt,
    type: decision.type,
    rawInput: decision.rawInput,
    decidedAt: decision.decidedAt,
    summary: decisionDisplayText(decision),
    points: decision.points ?? [],
  }));
}
