import type { PortfolioRuleGuidanceAnswer } from "@/schemas/portfolio/portfolio-rule-guidance-schema";
import type { PortfolioRuleGuidanceDraft } from "@/schemas/portfolio/portfolio-rule-guidance-schema";
import type { RiskTolerance } from "@/schemas/portfolio/portfolio-rule-schema";

// 固定質問の回答から、投資助言を挟まず一意に決まる項目だけを機械的に組み立てる。
// AIが数値を解釈し直す余地をなくし、回答どおりの数値が反映されることを保証する。
export type PortfolioRuleAnswerMappingResult = {
  draft: PortfolioRuleGuidanceDraft;
  undecidedKeys: string[];
};

const UNDECIDED_VALUES = new Set(["undecided", "free_text"]);

function findAnswer(
  answers: PortfolioRuleGuidanceAnswer[],
  key: string,
): PortfolioRuleGuidanceAnswer | undefined {
  return answers.find((answer) => answer.key === key);
}

export function buildDraftFromAnswers(
  answers: PortfolioRuleGuidanceAnswer[],
): PortfolioRuleAnswerMappingResult {
  const draft: PortfolioRuleGuidanceDraft = {};
  const undecidedKeys: string[] = [];

  const riskTolerance = findAnswer(answers, "risk_tolerance");
  if (riskTolerance) {
    if (UNDECIDED_VALUES.has(riskTolerance.value)) {
      undecidedKeys.push(riskTolerance.key);
    } else if (
      riskTolerance.value === "conservative" ||
      riskTolerance.value === "balanced" ||
      riskTolerance.value === "aggressive"
    ) {
      draft.riskTolerance = riskTolerance.value as RiskTolerance;
    } else {
      undecidedKeys.push(riskTolerance.key);
    }
  }

  const maxPositionCount = findAnswer(answers, "max_position_count");
  if (maxPositionCount) {
    if (UNDECIDED_VALUES.has(maxPositionCount.value)) {
      undecidedKeys.push(maxPositionCount.key);
    } else {
      const parsed = Number(maxPositionCount.value);
      if (Number.isFinite(parsed)) {
        draft.maxPositionCount = parsed;
      } else {
        undecidedKeys.push(maxPositionCount.key);
      }
    }
  }

  const maxPositionPercent = findAnswer(answers, "max_position_percent");
  if (maxPositionPercent) {
    if (UNDECIDED_VALUES.has(maxPositionPercent.value)) {
      undecidedKeys.push(maxPositionPercent.key);
    } else if (maxPositionPercent.value === "30plus") {
      draft.maxPositionPercent = 30;
    } else {
      const parsed = Number(maxPositionPercent.value);
      if (Number.isFinite(parsed)) {
        draft.maxPositionPercent = parsed;
      } else {
        undecidedKeys.push(maxPositionPercent.key);
      }
    }
  }

  const groupConcentration = findAnswer(answers, "group_concentration");
  if (groupConcentration) {
    if (UNDECIDED_VALUES.has(groupConcentration.value)) {
      undecidedKeys.push(groupConcentration.key);
    } else {
      const percent =
        groupConcentration.value === "50plus"
          ? 50
          : Number(groupConcentration.value);
      if (Number.isFinite(percent)) {
        draft.maxSectorPercent = percent;
        draft.maxThemePercent = percent;
      } else {
        undecidedKeys.push(groupConcentration.key);
      }
    }
  }

  const maxMarketPercent = findAnswer(answers, "max_market_percent");
  if (maxMarketPercent) {
    if (UNDECIDED_VALUES.has(maxMarketPercent.value)) {
      undecidedKeys.push(maxMarketPercent.key);
    } else if (maxMarketPercent.value === "no_limit") {
      // 本人が「集中してよい」と決めた状態。未定ではないので上限は設定しない。
    } else {
      const parsed = Number(maxMarketPercent.value);
      if (Number.isFinite(parsed)) {
        draft.maxMarketPercent = parsed;
      } else {
        undecidedKeys.push(maxMarketPercent.key);
      }
    }
  }

  const minCashPercent = findAnswer(answers, "min_cash_percent");
  if (minCashPercent) {
    if (UNDECIDED_VALUES.has(minCashPercent.value)) {
      undecidedKeys.push(minCashPercent.key);
    } else if (minCashPercent.value === "minimal") {
      // 本人が「ほとんど投資に回したい」と決めた状態。未定ではないので下限は設定しない。
    } else {
      const parsed = Number(minCashPercent.value);
      if (Number.isFinite(parsed)) {
        draft.minCashPercent = parsed;
      } else {
        undecidedKeys.push(minCashPercent.key);
      }
    }
  }

  const coreSatellite = findAnswer(answers, "core_satellite");
  if (coreSatellite) {
    if (UNDECIDED_VALUES.has(coreSatellite.value)) {
      undecidedKeys.push(coreSatellite.key);
    } else if (coreSatellite.value === "no_fund") {
      // 投信・ETFを持っていないため、コア・サテライトの配分は設定しない。
    } else {
      const parsed = Number(coreSatellite.value);
      if (Number.isFinite(parsed)) {
        draft.targetAllocations = [
          { key: "stock", targetPercent: parsed, tolerancePercent: 5 },
        ];
      } else {
        undecidedKeys.push(coreSatellite.key);
      }
    }
  }

  const excludedAssetTypes = findAnswer(answers, "excluded_asset_types");
  if (excludedAssetTypes) {
    if (excludedAssetTypes.value === "free_text") {
      undecidedKeys.push(excludedAssetTypes.key);
    } else if (excludedAssetTypes.value === "none") {
      draft.excludedAssetTypes = [];
    } else {
      draft.excludedAssetTypes = excludedAssetTypes.value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item !== "none");
    }
  }

  const maxSingleTradeLossPercent = findAnswer(
    answers,
    "max_single_trade_loss_percent",
  );
  if (maxSingleTradeLossPercent) {
    if (UNDECIDED_VALUES.has(maxSingleTradeLossPercent.value)) {
      undecidedKeys.push(maxSingleTradeLossPercent.key);
    } else {
      const parsed = Number(maxSingleTradeLossPercent.value);
      if (Number.isFinite(parsed)) {
        draft.maxSingleTradeLossPercent = parsed;
      } else {
        undecidedKeys.push(maxSingleTradeLossPercent.key);
      }
    }
  }

  return { draft, undecidedKeys };
}
