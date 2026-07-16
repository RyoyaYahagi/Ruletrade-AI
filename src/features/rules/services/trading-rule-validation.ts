import type {
  AgentRole,
  RuleWarning,
  RuleWarningSeverity,
  TradingRule,
} from "@/schemas/rules/trading-rule";
import type { TradeRule } from "@/schemas/rules/trade-rule-schema";

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
      }),
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
      }),
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
      }),
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
      }),
    );
  }

  const hasBlockers = warnings.some(
    (warning) => warning.severity === "blocker",
  );

  return {
    canApprove: !hasBlockers && rule.approval.required,
    warnings: dedupeWarnings(warnings),
  };
}

export function canApproveTradingRule(rule: TradingRule): boolean {
  return validateTradingRule(rule).canApprove;
}

export type MonitoringQualityCheck = {
  checkKey: string;
  label: string;
  status: "warning" | "fail";
  severity: "medium" | "high";
  reason: string;
  suggestedQuestion: string;
};

export function buildMonitoringQualityChecks(
  rule: TradeRule,
): MonitoringQualityCheck[] {
  const checks: MonitoringQualityCheck[] = [];
  const monitoring = rule.monitoring;

  if (rule.investmentThesis?.trim() && rule.thesisBreakers.length === 0) {
    checks.push({
      checkKey: "missing_thesis_breakers",
      label: "仮説の破れ条件",
      status: "warning",
      severity: "medium",
      reason: "投資仮説はありますが、どの事実で見立てを見直すかが未設定です。",
      suggestedQuestion: "どの観測可能な事実で投資仮説を見直しますか？",
    });
  }

  const hasPriceThreshold = [
    monitoring.stopLossReviewPercent,
    monitoring.takeProfitReviewPercent,
    monitoring.drawdownFromHighPercent,
  ].some((value) => value !== undefined);
  if (!hasPriceThreshold) {
    checks.push({
      checkKey: "missing_monitoring_threshold",
      label: "価格監視の閾値",
      status: "warning",
      severity: "medium",
      reason: "価格を確認する閾値が未設定です。監視を使わない場合はその判断を保留できます。",
      suggestedQuestion: "価格の変化をどの条件で確認するか決めますか？",
    });
  }

  if (
    (monitoring.stopLossReviewPercent ?? -1) >= 100 ||
    monitoring.takeProfitReviewPercent === 0
  ) {
    // 監視は任意機能なので未設定はブロッカーにせず、数値が矛盾する場合だけ停止する。
    checks.push({
      checkKey: "contradictory_monitoring",
      label: "監視設定の矛盾",
      status: "fail",
      severity: "high",
      reason:
        "下落率100%以上、または上昇率0%の監視条件は成立条件として解釈できません。",
      suggestedQuestion: "価格監視の閾値を成立する数値に修正してください。",
    });
  }

  return checks;
}

export function validateTradeRuleMonitoring(rule: TradeRule) {
  const warnings = buildMonitoringQualityChecks(rule);
  return {
    canApprove: !warnings.some((warning) => warning.status === "fail"),
    warnings,
  };
}

function dedupeWarnings(warnings: RuleWarning[]): RuleWarning[] {
  const warningsById = new Map<string, RuleWarning>();

  for (const warning of warnings) {
    warningsById.set(warning.id, warning);
  }

  return [...warningsById.values()];
}
