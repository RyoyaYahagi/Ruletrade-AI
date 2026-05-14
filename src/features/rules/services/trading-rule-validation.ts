import type {
  AgentRole,
  RuleWarning,
  RuleWarningSeverity,
  TradingRule,
} from "@/schemas/rules/trading-rule";

export type RuleValidationResult = {
  canApprove: boolean;
  warnings: RuleWarning[];
};

type RuleWarningInput = {
  id: string;
  severity: RuleWarningSeverity;
  title: string;
  detail: string;
  owner: AgentRole;
};

const unresolvedEvidenceValues = new Set(["", "未検証", "未算出", "unknown"]);

export function createRuleWarning(input: RuleWarningInput): RuleWarning {
  return input;
}

export function hasBlockerWarnings(rule: TradingRule): boolean {
  return rule.warnings.some((warning) => warning.severity === "blocker");
}

export function validateTradingRule(rule: TradingRule): RuleValidationResult {
  const warnings = [...rule.warnings];

  if (rule.entryConditions.length === 0) {
    warnings.push(
      createRuleWarning({
        id: "validation-entry-missing",
        severity: "blocker",
        title: "Entry conditions are missing",
        detail:
          "A rule cannot be reviewed or approved without entry conditions.",
        owner: "risk_reviewer",
      })
    );
  }

  if (rule.exitConditions.length === 0) {
    warnings.push(
      createRuleWarning({
        id: "validation-exit-missing",
        severity: "blocker",
        title: "Exit conditions are missing",
        detail: "A rule must define when the position should be closed.",
        owner: "risk_reviewer",
      })
    );
  }

  if (rule.riskLimits.length === 0) {
    warnings.push(
      createRuleWarning({
        id: "validation-risk-limit-missing",
        severity: "blocker",
        title: "Risk limits are missing",
        detail:
          "A rule must define position sizing or maximum-loss constraints.",
        owner: "risk_reviewer",
      })
    );
  }

  if (
    rule.evidence.confidence === "unverified" ||
    rule.evidence.sampleSize <= 0 ||
    unresolvedEvidenceValues.has(rule.evidence.backtestWindow.trim())
  ) {
    warnings.push(
      createRuleWarning({
        id: "validation-evidence-missing",
        severity: "blocker",
        title: "Evaluation evidence is missing",
        detail:
          "Backtest window, sample size, and confidence must be recorded before approval.",
        owner: "backtest_evaluator",
      })
    );
  }

  const hasBlockers = warnings.some(
    (warning) => warning.severity === "blocker"
  );

  return {
    canApprove: !hasBlockers && rule.approval.required,
    warnings: dedupeWarnings(warnings),
  };
}

export function canApproveTradingRule(rule: TradingRule): boolean {
  return validateTradingRule(rule).canApprove;
}

function dedupeWarnings(warnings: RuleWarning[]): RuleWarning[] {
  const warningsById = new Map<string, RuleWarning>();

  for (const warning of warnings) {
    warningsById.set(warning.id, warning);
  }

  return [...warningsById.values()];
}
