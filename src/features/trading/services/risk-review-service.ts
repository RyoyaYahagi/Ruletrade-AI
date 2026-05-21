import "server-only";

export type WarningCategory =
  | "contradiction"
  | "future_data_leakage"
  | "missing_exit"
  | "missing_risk_limit"
  | "overfitting"
  | "explanation_mismatch"
  | "unsafe_parameter"
  | "insufficient_evidence";

export type WarningSeverity = "low" | "medium" | "high" | "critical";

export type RiskWarning = {
  category: WarningCategory;
  severity: WarningSeverity;
  message: string;
  blocker: boolean;
  suggestion: string;
};

export type RiskReviewResult = {
  passed: boolean;
  warnings: RiskWarning[];
  blockerCount: number;
};

function createWarning(
  category: WarningCategory,
  severity: WarningSeverity,
  message: string,
  suggestion: string,
  blocker: boolean
): RiskWarning {
  return { category, severity, message, suggestion, blocker };
}

export function reviewTradingRuleRisk(params: {
  entryConditions: Array<Record<string, unknown>>;
  exitConditions: Array<Record<string, unknown>>;
  riskLimits: Record<string, unknown>;
  assumptions: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  naturalLanguageSummary?: string | null;
}): RiskReviewResult {
  const warnings: RiskWarning[] = [];

  // 1. Missing exit conditions
  if (!params.exitConditions || params.exitConditions.length === 0) {
    warnings.push(
      createWarning(
        "missing_exit",
        "critical",
        "No exit conditions defined.",
        "Add at least one exit condition (stop loss, take profit, or time-based).",
        true
      )
    );
  }

  // 2. Missing risk limits
  const riskKeys = Object.keys(params.riskLimits ?? {});
  const hasPositionLimit = riskKeys.some((k) =>
    k.toLowerCase().includes("position")
  );
  const hasLossLimit = riskKeys.some((k) =>
    k.toLowerCase().includes("loss")
  );
  if (!hasPositionLimit || !hasLossLimit) {
    warnings.push(
      createWarning(
        "missing_risk_limit",
        "high",
        "Missing essential risk limits.",
        "Define maxPositionSize and maxLossPerTrade in riskLimits.",
        true
      )
    );
  }

  // 3. Entry/exit contradiction
  const entryFields = new Set(
    params.entryConditions.map((c) => String(c.field ?? "").toLowerCase())
  );
  const exitFields = new Set(
    params.exitConditions.map((c) => String(c.field ?? "").toLowerCase())
  );
  const commonFields = Array.from(entryFields).filter((f) => exitFields.has(f));
  if (commonFields.length > 0) {
    warnings.push(
      createWarning(
        "contradiction",
        "high",
        `Entry and exit conditions use the same field(s): ${commonFields.join(", ")}.`,
        "Ensure entry and exit conditions do not conflict on the same field.",
        true
      )
    );
  }

  // 4. Overfitting risk (too many conditions)
  if (params.entryConditions.length > 5 || params.exitConditions.length > 5) {
    warnings.push(
      createWarning(
        "overfitting",
        "medium",
        "Too many conditions may indicate overfitting.",
        "Simplify conditions. More than 5 entry or exit conditions increases overfitting risk.",
        false
      )
    );
  }

  // 5. Insufficient evidence
  if (!params.evidence || params.evidence.length === 0) {
    warnings.push(
      createWarning(
        "insufficient_evidence",
        "medium",
        "No supporting evidence provided.",
        "Add backtest results, historical data, or research references as evidence.",
        false
      )
    );
  }

  // 6. Explanation mismatch (if summary provided but very short)
  const summary = params.naturalLanguageSummary ?? "";
  if (summary.length > 0 && summary.length < 50) {
    warnings.push(
      createWarning(
        "explanation_mismatch",
        "low",
        "Rule summary is very short and may not fully explain the strategy.",
        "Expand the natural language summary to at least 50 characters.",
        false
      )
    );
  }

  // 7. Unsafe parameters (extreme values)
  for (const cond of params.entryConditions) {
    const val = Number(cond.value);
    if (!Number.isNaN(val) && (val < 0 || val > 1000000)) {
      warnings.push(
        createWarning(
          "unsafe_parameter",
          "high",
          `Entry condition has an extreme value: ${val}.`,
          "Review the condition value for correctness.",
          true
        )
      );
    }
  }

  const blockerCount = warnings.filter((w) => w.blocker).length;

  return {
    passed: blockerCount === 0,
    warnings,
    blockerCount,
  };
}
