import type { PortfolioCommonRule } from "@/schemas/portfolio/portfolio-rule-schema";

// 共通ルールが設定済みのとき、銘柄別ルールで重複して質問しないフィールド。
export function getCoveredRuleFields(
  rule: PortfolioCommonRule | null,
): string[] {
  if (!rule) return [];

  const covered: string[] = [];

  if (rule.maxPositionPercent != null) {
    covered.push(
      "riskManagement.maxPositionPercent",
      "riskManagement.maxPositionAmount",
    );
  }

  if (rule.maxSingleTradeLossPercent != null) {
    covered.push("riskManagement.maxLossPercent");
  }

  return covered;
}

export function filterQuestionsCoveredByCommonRule<
  T extends { mapsToRuleField?: string | null },
>(questions: T[], coveredFields: string[]): T[] {
  if (coveredFields.length === 0) return questions;

  return questions.filter(
    (question) =>
      !question.mapsToRuleField ||
      !coveredFields.includes(question.mapsToRuleField),
  );
}

export function buildCommonRuleContextText(
  rule: PortfolioCommonRule | null,
): string | null {
  if (!rule) return null;

  const lines: string[] = [];

  if (rule.maxPositionPercent != null) {
    lines.push(`1銘柄の最大比率: ${rule.maxPositionPercent}%`);
  }
  if (rule.maxSectorPercent != null) {
    lines.push(`1セクターの最大比率: ${rule.maxSectorPercent}%`);
  }
  if (rule.maxThemePercent != null) {
    lines.push(`1テーマの最大比率: ${rule.maxThemePercent}%`);
  }
  if (rule.minCashPercent != null) {
    lines.push(`現金比率の下限: ${rule.minCashPercent}%`);
  }
  if (rule.maxSingleTradeLossPercent != null) {
    lines.push(
      `1取引あたりの許容損失: 資産全体の${rule.maxSingleTradeLossPercent}%`,
    );
  }
  for (const target of rule.targetAllocations) {
    lines.push(
      `目標配分 ${target.label ?? target.key}: ${target.targetPercent}%（許容±${target.tolerancePercent}pt）`,
    );
  }
  if (rule.notes) {
    lines.push(`メモ: ${rule.notes}`);
  }

  if (lines.length === 0) return null;

  return lines.join("\n");
}
