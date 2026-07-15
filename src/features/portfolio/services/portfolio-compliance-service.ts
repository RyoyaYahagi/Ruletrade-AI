import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { getOrCreateMainPortfolio } from "@/features/portfolio/services/portfolio-service";
import { getPortfolioCommonRule } from "@/features/portfolio/services/portfolio-rule-service";
import type {
  PortfolioCommonRule,
  PositionCheckRequest,
} from "@/schemas/portfolio/portfolio-rule-schema";

export type CompliancePositionInput = {
  ticker: string;
  market_value: number;
  sector?: string | null;
  theme?: string | null;
  asset_type?: string | null;
  market?: string | null;
};

export type RuleViolation = {
  ruleKey:
    | "max_position_percent"
    | "max_sector_percent"
    | "max_theme_percent"
    | "min_cash_percent"
    | "target_allocation";
  subject: string;
  limitPercent: number;
  actualPercent: number;
  severity: "medium" | "high";
  message: string;
};

const HIGH_SEVERITY_EXCESS_POINTS = 5;

function roundPercent(value: number) {
  return Number(value.toFixed(2));
}

function severityForExcess(excessPoints: number): "medium" | "high" {
  return excessPoints > HIGH_SEVERITY_EXCESS_POINTS ? "high" : "medium";
}

function sumByKey(
  positions: CompliancePositionInput[],
  selectKey: (position: CompliancePositionInput) => string | null | undefined,
) {
  const map = new Map<string, number>();
  for (const position of positions) {
    const key = selectKey(position);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + Number(position.market_value ?? 0));
  }
  return map;
}

export function evaluatePortfolioCompliance(params: {
  rule: PortfolioCommonRule | null;
  cashAmount: number;
  positions: CompliancePositionInput[];
}): { totalValue: number; cashPercent: number; violations: RuleViolation[] } {
  const totalPositionValue = params.positions.reduce(
    (sum, position) => sum + Number(position.market_value ?? 0),
    0,
  );
  const totalValue = totalPositionValue + params.cashAmount;
  const cashPercent =
    totalValue === 0 ? 0 : roundPercent((params.cashAmount / totalValue) * 100);

  const violations: RuleViolation[] = [];
  const rule = params.rule;

  if (!rule || totalValue === 0) {
    return { totalValue, cashPercent, violations };
  }

  const toPercent = (value: number) => roundPercent((value / totalValue) * 100);

  if (rule.maxPositionPercent != null) {
    const byTicker = sumByKey(params.positions, (p) => p.ticker);
    for (const [ticker, value] of byTicker) {
      const percent = toPercent(value);
      if (percent > rule.maxPositionPercent) {
        violations.push({
          ruleKey: "max_position_percent",
          subject: ticker,
          limitPercent: rule.maxPositionPercent,
          actualPercent: percent,
          severity: severityForExcess(percent - rule.maxPositionPercent),
          message: `「1銘柄の最大比率${rule.maxPositionPercent}%」に対して、${ticker}が${percent}%になっています。`,
        });
      }
    }
  }

  if (rule.maxSectorPercent != null) {
    const bySector = sumByKey(params.positions, (p) => p.sector);
    for (const [sector, value] of bySector) {
      const percent = toPercent(value);
      if (percent > rule.maxSectorPercent) {
        violations.push({
          ruleKey: "max_sector_percent",
          subject: sector,
          limitPercent: rule.maxSectorPercent,
          actualPercent: percent,
          severity: severityForExcess(percent - rule.maxSectorPercent),
          message: `「1セクターの最大比率${rule.maxSectorPercent}%」に対して、${sector}が${percent}%になっています。`,
        });
      }
    }
  }

  if (rule.maxThemePercent != null) {
    const byTheme = sumByKey(params.positions, (p) => p.theme);
    for (const [theme, value] of byTheme) {
      const percent = toPercent(value);
      if (percent > rule.maxThemePercent) {
        violations.push({
          ruleKey: "max_theme_percent",
          subject: theme,
          limitPercent: rule.maxThemePercent,
          actualPercent: percent,
          severity: severityForExcess(percent - rule.maxThemePercent),
          message: `「1テーマの最大比率${rule.maxThemePercent}%」に対して、${theme}が${percent}%になっています。`,
        });
      }
    }
  }

  if (rule.minCashPercent != null && cashPercent < rule.minCashPercent) {
    violations.push({
      ruleKey: "min_cash_percent",
      subject: "現金",
      limitPercent: rule.minCashPercent,
      actualPercent: cashPercent,
      severity: severityForExcess(rule.minCashPercent - cashPercent),
      message: `「現金比率${rule.minCashPercent}%以上」に対して、現在の現金比率が${cashPercent}%になっています。`,
    });
  }

  if (rule.targetAllocations.length > 0) {
    const byAssetType = sumByKey(params.positions, (p) => p.asset_type);
    for (const target of rule.targetAllocations) {
      const value =
        target.key === "cash" ? params.cashAmount : (byAssetType.get(target.key) ?? 0);
      const percent = toPercent(value);
      const deviation = Math.abs(percent - target.targetPercent);
      if (deviation > target.tolerancePercent) {
        const label = target.label ?? target.key;
        violations.push({
          ruleKey: "target_allocation",
          subject: target.key,
          limitPercent: target.targetPercent,
          actualPercent: percent,
          severity: severityForExcess(deviation - target.tolerancePercent),
          message: `「${label}の目標比率${target.targetPercent}%（許容±${target.tolerancePercent}pt）」に対して、現在${percent}%になっています。`,
        });
      }
    }
  }

  return { totalValue, cashPercent, violations };
}

export type PositionImpactResult = {
  before: ReturnType<typeof evaluatePortfolioCompliance>;
  after: ReturnType<typeof evaluatePortfolioCompliance>;
  newViolations: RuleViolation[];
  tickerPercentAfter: number;
  sectorPercentAfter: number | null;
  themePercentAfter: number | null;
  insufficientCash: boolean;
};

export function simulatePositionImpact(params: {
  rule: PortfolioCommonRule | null;
  cashAmount: number;
  positions: CompliancePositionInput[];
  candidate: PositionCheckRequest;
}): PositionImpactResult {
  const before = evaluatePortfolioCompliance({
    rule: params.rule,
    cashAmount: params.cashAmount,
    positions: params.positions,
  });

  const candidatePosition: CompliancePositionInput = {
    ticker: params.candidate.ticker,
    market_value: params.candidate.marketValue,
    sector: params.candidate.sector ?? null,
    theme: params.candidate.theme ?? null,
    asset_type: params.candidate.assetType ?? null,
    market: params.candidate.market ?? null,
  };

  const insufficientCash =
    params.candidate.fundedFromCash &&
    params.candidate.marketValue > params.cashAmount;

  const cashAfter = params.candidate.fundedFromCash
    ? Math.max(0, params.cashAmount - params.candidate.marketValue)
    : params.cashAmount;

  const positionsAfter = [...params.positions, candidatePosition];

  const after = evaluatePortfolioCompliance({
    rule: params.rule,
    cashAmount: cashAfter,
    positions: positionsAfter,
  });

  const beforeKeys = new Set(
    before.violations.map((v) => `${v.ruleKey}:${v.subject}`),
  );
  const newViolations = after.violations.filter(
    (v) => !beforeKeys.has(`${v.ruleKey}:${v.subject}`),
  );

  const toAfterPercent = (value: number) =>
    after.totalValue === 0
      ? 0
      : Number(((value / after.totalValue) * 100).toFixed(2));

  const tickerValueAfter = positionsAfter
    .filter((p) => p.ticker === params.candidate.ticker)
    .reduce((sum, p) => sum + Number(p.market_value ?? 0), 0);

  const sectorValueAfter = params.candidate.sector
    ? positionsAfter
        .filter((p) => p.sector === params.candidate.sector)
        .reduce((sum, p) => sum + Number(p.market_value ?? 0), 0)
    : null;

  const themeValueAfter = params.candidate.theme
    ? positionsAfter
        .filter((p) => p.theme === params.candidate.theme)
        .reduce((sum, p) => sum + Number(p.market_value ?? 0), 0)
    : null;

  return {
    before,
    after,
    newViolations,
    tickerPercentAfter: toAfterPercent(tickerValueAfter),
    sectorPercentAfter:
      sectorValueAfter === null ? null : toAfterPercent(sectorValueAfter),
    themePercentAfter:
      themeValueAfter === null ? null : toAfterPercent(themeValueAfter),
    insufficientCash,
  };
}

async function loadPortfolioState(userId: string) {
  const db = await createDatabaseClient();
  const { portfolio } = await getOrCreateMainPortfolio({ userId });

  const { data: positions, error } = await db
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", userId)
    .eq("portfolio_id", portfolio.id)
    .neq("position_status", "archived");

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "保有銘柄一覧の取得に失敗しました。",
      500,
      error,
    );
  }

  return {
    cashAmount: Number(portfolio.cash_amount ?? 0),
    positions: (positions ?? []) as CompliancePositionInput[],
  };
}

export async function getPortfolioCompliance(params: { userId: string }) {
  const { rule } = await getPortfolioCommonRule({ userId: params.userId });
  const { cashAmount, positions } = await loadPortfolioState(params.userId);

  const result = evaluatePortfolioCompliance({ rule, cashAmount, positions });

  return {
    ruleConfigured: rule !== null,
    ...result,
  };
}

export async function checkPositionImpact(params: {
  userId: string;
  candidate: PositionCheckRequest;
}) {
  const { rule } = await getPortfolioCommonRule({ userId: params.userId });
  const { cashAmount, positions } = await loadPortfolioState(params.userId);

  const result = simulatePositionImpact({
    rule,
    cashAmount,
    positions,
    candidate: params.candidate,
  });

  return {
    ruleConfigured: rule !== null,
    ...result,
  };
}
