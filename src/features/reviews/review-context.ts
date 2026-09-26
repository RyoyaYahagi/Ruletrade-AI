import type { Decision } from "@/schemas/decision";

export function buildComparisonContext(decisions: Decision[]) {
  return decisions.map((decision) => ({
    createdAt: decision.createdAt,
    type: decision.type,
    rawInput: decision.rawInput,
    thesis: decision.thesis,
    assumptions: decision.assumptions,
    reviewConditions: decision.reviewConditions,
    addConditions: decision.addConditions,
  }));
}
