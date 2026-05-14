export const ruleStatuses = [
  "draft",
  "in_review",
  "blocked",
  "approved",
  "rejected",
] as const;

export type RuleStatus = (typeof ruleStatuses)[number];

export const agentRoles = [
  "orchestrator",
  "rule_generator",
  "risk_reviewer",
  "backtest_evaluator",
  "explanation_writer",
] as const;

export type AgentRole = (typeof agentRoles)[number];

export const riskLevels = ["low", "medium", "high"] as const;

export type RiskLevel = (typeof riskLevels)[number];

export const ruleWarningSeverities = ["info", "warning", "blocker"] as const;

export type RuleWarningSeverity = (typeof ruleWarningSeverities)[number];

export const evidenceConfidenceLevels = [
  "unverified",
  "low",
  "medium",
  "high",
] as const;

export type EvidenceConfidence = (typeof evidenceConfidenceLevels)[number];

export type RuleWarning = {
  id: string;
  severity: RuleWarningSeverity;
  title: string;
  detail: string;
  owner: AgentRole;
};

export type TradingRule = {
  id: string;
  title: string;
  status: RuleStatus;
  market: string;
  timeframe: string;
  riskLevel: RiskLevel;
  entryConditions: string[];
  exitConditions: string[];
  riskLimits: string[];
  assumptions: string[];
  evidence: {
    backtestWindow: string;
    sampleSize: number;
    expectedMaxDrawdown: string;
    confidence: EvidenceConfidence;
  };
  warnings: RuleWarning[];
  approval: {
    required: boolean;
    reason: string;
  };
};

export type InvestmentMemory = {
  riskTolerance: RiskLevel;
  preferredMarkets: string[];
  timeHorizons: string[];
  rejectedPatterns: string[];
  standingConstraints: string[];
};

export function isRuleStatus(value: string): value is RuleStatus {
  return (ruleStatuses as readonly string[]).includes(value);
}

export function isAgentRole(value: string): value is AgentRole {
  return (agentRoles as readonly string[]).includes(value);
}

export function isRiskLevel(value: string): value is RiskLevel {
  return (riskLevels as readonly string[]).includes(value);
}

export function isRuleWarningSeverity(
  value: string
): value is RuleWarningSeverity {
  return (ruleWarningSeverities as readonly string[]).includes(value);
}

export function isEvidenceConfidence(
  value: string
): value is EvidenceConfidence {
  return (evidenceConfidenceLevels as readonly string[]).includes(value);
}
