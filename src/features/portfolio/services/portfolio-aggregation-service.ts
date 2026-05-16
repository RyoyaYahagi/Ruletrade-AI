import "server-only";

type PortfolioAllocationSlice = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

function toSlices(
  map: Map<string, number>,
  total: number,
): PortfolioAllocationSlice[] {
  const entries = Array.from(map.entries());
  const slices = entries.map(([key, value]) => ({
    key,
    label: key,
    value: Number(value.toFixed(2)),
    percent: total === 0 ? 0 : Number(((value / total) * 100).toFixed(2)),
  }));

  return slices.sort((a, b) => b.value - a.value);
}

export function calculatePortfolioSummary(params: {
  cashAmount: number;
  positions: Array<{
    ticker: string;
    company_name?: string | null;
    market_value: number;
    sector?: string | null;
    theme?: string | null;
    currency?: string | null;
    rule_session_id?: string | null;
  }>;
}) {
  const totalPositionValue = params.positions.reduce(
    (sum, position) => sum + Number(position.market_value ?? 0),
    0,
  );

  const totalValue = totalPositionValue + params.cashAmount;

  const positionsWithWeight = params.positions.map((position) => {
    const marketValue = Number(position.market_value ?? 0);

    return {
      ...position,
      weightPercent:
        totalValue === 0
          ? 0
          : Number(((marketValue / totalValue) * 100).toFixed(2)),
    };
  });

  const cashWeightPercent =
    totalValue === 0
      ? 0
      : Number(((params.cashAmount / totalValue) * 100).toFixed(2));

  const sectorWeights = new Map<string, number>();

  for (const position of positionsWithWeight) {
    const sector = position.sector ?? "未分類";
    sectorWeights.set(
      sector,
      (sectorWeights.get(sector) ?? 0) + position.weightPercent,
    );
  }

  return {
    totalValue,
    totalPositionValue,
    cashAmount: params.cashAmount,
    cashWeightPercent,
    positionCount: params.positions.length,
    positionsWithWeight,
    sectorWeights: Array.from(sectorWeights.entries()).map(
      ([sector, weightPercent]) => ({
        sector,
        weightPercent: Number(weightPercent.toFixed(2)),
      }),
    ),
    positionsWithoutRuleCount: params.positions.filter(
      (position) => !position.rule_session_id,
    ).length,
  };
}

export function calculatePortfolioAllocationSummary(params: {
  cashAmount: number;
  positions: Array<{
    market_value: number;
    market?: string | null;
    asset_type?: string | null;
    sector?: string | null;
    theme?: string | null;
  }>;
}) {
  const totalValue =
    params.positions.reduce((sum, p) => sum + Number(p.market_value ?? 0), 0) +
    params.cashAmount;

  const marketMap = new Map<string, number>();
  const assetTypeMap = new Map<string, number>();
  const sectorMap = new Map<string, number>();
  const themeMap = new Map<string, number>();
  const jpSectorMap = new Map<string, number>();
  const jpThemeMap = new Map<string, number>();
  const usSectorMap = new Map<string, number>();
  const usThemeMap = new Map<string, number>();

  for (const position of params.positions) {
    const value = Number(position.market_value ?? 0);
    if (value <= 0) continue;

    const market = position.market ?? "未分類";
    const assetType = position.asset_type ?? "未分類";
    const sector = position.sector ?? "未分類";
    const theme = position.theme ?? "未分類";

    marketMap.set(market, (marketMap.get(market) ?? 0) + value);
    assetTypeMap.set(assetType, (assetTypeMap.get(assetType) ?? 0) + value);
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + value);
    themeMap.set(theme, (themeMap.get(theme) ?? 0) + value);

    if (market === "JP") {
      jpSectorMap.set(sector, (jpSectorMap.get(sector) ?? 0) + value);
      jpThemeMap.set(theme, (jpThemeMap.get(theme) ?? 0) + value);
    } else if (market === "US") {
      usSectorMap.set(sector, (usSectorMap.get(sector) ?? 0) + value);
      usThemeMap.set(theme, (usThemeMap.get(theme) ?? 0) + value);
    }
  }

  return {
    totalValue,
    cashValue: params.cashAmount,
    marketAllocation: toSlices(marketMap, totalValue),
    assetTypeAllocation: toSlices(assetTypeMap, totalValue),
    sectorAllocation: toSlices(sectorMap, totalValue),
    themeAllocation: toSlices(themeMap, totalValue),
    jpSectorAllocation: toSlices(jpSectorMap, totalValue),
    jpThemeAllocation: toSlices(jpThemeMap, totalValue),
    usSectorAllocation: toSlices(usSectorMap, totalValue),
    usThemeAllocation: toSlices(usThemeMap, totalValue),
  };
}
