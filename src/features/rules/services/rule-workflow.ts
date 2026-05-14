import type { RuleStatus } from "@/schemas/rules/trading-rule";

export const allowedRuleStatusTransitions: Record<RuleStatus, RuleStatus[]> = {
  draft: ["in_review", "blocked", "rejected"],
  in_review: ["blocked", "approved", "rejected"],
  blocked: ["draft", "in_review", "rejected"],
  approved: ["in_review", "rejected"],
  rejected: ["draft"],
};

export function canTransitionRuleStatus(
  from: RuleStatus,
  to: RuleStatus
): boolean {
  return allowedRuleStatusTransitions[from].includes(to);
}

export function getAllowedRuleStatusTransitions(
  from: RuleStatus
): RuleStatus[] {
  return allowedRuleStatusTransitions[from];
}
