export type RuleStatus =
  | "draft"
  | "in_review"
  | "blocked"
  | "approved"
  | "rejected"

export type AgentRole =
  | "orchestrator"
  | "rule_generator"
  | "risk_reviewer"
  | "backtest_evaluator"
  | "explanation_writer"

export type RiskLevel = "low" | "medium" | "high"

export type RuleWarningSeverity = "info" | "warning" | "blocker"

export type RuleWarning = {
  id: string
  severity: RuleWarningSeverity
  title: string
  detail: string
  owner: AgentRole
}

export type TradingRule = {
  id: string
  title: string
  status: RuleStatus
  market: string
  timeframe: string
  riskLevel: RiskLevel
  entryConditions: string[]
  exitConditions: string[]
  riskLimits: string[]
  assumptions: string[]
  evidence: {
    backtestWindow: string
    sampleSize: number
    expectedMaxDrawdown: string
    confidence: "unverified" | "low" | "medium" | "high"
  }
  warnings: RuleWarning[]
  approval: {
    required: boolean
    reason: string
  }
}

export type InvestmentMemory = {
  riskTolerance: RiskLevel
  preferredMarkets: string[]
  timeHorizons: string[]
  rejectedPatterns: string[]
  standingConstraints: string[]
}

