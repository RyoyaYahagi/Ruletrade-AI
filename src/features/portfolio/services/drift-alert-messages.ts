export function buildDriftAlertMessage(params: {
  finding: {
    targetType: string;
    targetKey: string | null;
    currentPercent: number;
    targetPercent: number;
    tolerancePercent: number;
    driftPercent: number;
  };
  hasStaleData: boolean;
}) {
  const staleNote = params.hasStaleData ? " 一部の価格が古いため概算です。" : "";
  if (params.finding.targetType === "cash_percent") {
    return `現金比率が${params.finding.currentPercent}%になり、あなたの目標${params.finding.targetPercent}%±${params.finding.tolerancePercent}%から外れています。ポートフォリオを確認してください。${staleNote}`;
  }

  const symbol = params.finding.targetKey ?? "対象銘柄";
  if (params.finding.targetType === "position_max_percent") {
    return `${symbol}が資産の${params.finding.currentPercent}%になり、あなたが決めた上限${params.finding.targetPercent}%を${Math.abs(params.finding.driftPercent)}pt超えています。ポートフォリオを確認してください。${staleNote}`;
  }

  return `${symbol}が資産の${params.finding.currentPercent}%になり、あなたの目標${params.finding.targetPercent}%±${params.finding.tolerancePercent}%から${Math.abs(params.finding.driftPercent)}pt外れています。ポートフォリオを確認してください。${staleNote}`;
}
