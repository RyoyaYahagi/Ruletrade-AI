import type { Decision } from "@/schemas/decision";

export function decisionDisplayText(
  decision: Pick<Decision, "summary" | "thesis" | "rawInput">,
): string {
  return decision.summary ?? decision.thesis ?? decision.rawInput;
}
