import type { PortfolioTarget } from "@/features/portfolio/services/portfolio-target-service";

export type DriftFinding = {
  targetType: PortfolioTarget["target_type"];
  targetKey: string | null;
  currentPercent: number;
  targetPercent: number;
  tolerancePercent: number;
  driftPercent: number;
  exceeded: boolean;
};

export type DriftFindings = Array<DriftFinding> & { hasStaleData: boolean };

type DriftPosition = {
  symbol: string;
  valuationJpy: number;
  stale?: boolean;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

function makeFinding(params: {
  target: PortfolioTarget;
  targetKey: string | null;
  currentPercent: number;
}) {
  const targetPercent = Number(params.target.target_percent);
  const tolerancePercent = Number(params.target.tolerance_percent);
  const driftPercent = round(params.currentPercent - targetPercent);
  const exceeded =
    params.target.target_type === "position_max_percent"
      ? params.currentPercent > targetPercent + tolerancePercent
      : Math.abs(driftPercent) > tolerancePercent;

  return {
    targetType: params.target.target_type,
    targetKey: params.targetKey,
    currentPercent: round(params.currentPercent),
    targetPercent,
    tolerancePercent,
    driftPercent,
    exceeded,
  } satisfies DriftFinding;
}

export function calculateDrift(params: {
  positions: DriftPosition[];
  cashJpy: number;
  targets: PortfolioTarget[];
}): DriftFindings {
  const totalValue =
    Math.max(0, Number(params.cashJpy)) +
    params.positions.reduce(
      (sum, position) => sum + Math.max(0, Number(position.valuationJpy)),
      0,
    );
  const result = [] as unknown as DriftFindings;
  Object.defineProperty(result, "hasStaleData", {
    value: params.positions.some((position) => position.stale === true),
    enumerable: true,
    writable: false,
  });

  for (const target of params.targets) {
    if (target.target_type === "cash_percent") {
      result.push(
        makeFinding({
          target,
          targetKey: null,
          currentPercent: totalValue === 0 ? 0 : (params.cashJpy / totalValue) * 100,
        }),
      );
      continue;
    }

    if (target.target_type === "position_max_percent" && target.target_key === "*") {
      for (const position of params.positions) {
        result.push(
          makeFinding({
            target,
            targetKey: position.symbol,
            currentPercent:
              totalValue === 0 ? 0 : (position.valuationJpy / totalValue) * 100,
          }),
        );
      }
      continue;
    }

    const symbol = target.target_key;
    const position = params.positions.find((candidate) => candidate.symbol === symbol);
    result.push(
      makeFinding({
        target,
        targetKey: symbol,
        currentPercent:
          totalValue === 0 || !position ? 0 : (position.valuationJpy / totalValue) * 100,
      }),
    );
  }

  return result;
}
