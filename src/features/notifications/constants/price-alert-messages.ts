export const PRICE_ALERT_CONDITION_KEYS = [
  "stop_loss_review",
  "take_profit_review",
  "drawdown_from_high",
  "target_price_reached",
  "cooldown_triggered",
  "price_data_stale",
] as const;

export type PriceAlertConditionKey =
  (typeof PRICE_ALERT_CONDITION_KEYS)[number];

export function buildPriceAlertMessage(params: {
  conditionKey: Exclude<PriceAlertConditionKey, "price_data_stale">;
  companyName?: string | null;
  ticker: string;
  price: number;
  threshold?: number | null;
  targetPrice?: number | null;
  dailyDropPercent?: number | null;
  cooldownHours?: number | null;
}) {
  const security = `${params.companyName ?? params.ticker} (${params.ticker})`;
  const price = formatNumber(params.price);

  switch (params.conditionKey) {
    case "stop_loss_review":
      return `${security}の終値${price}円が、あなたのルール「取得価格から${formatNumber(params.threshold ?? 0)}%下落したら見直す」の条件を満たしました。ルールを確認してください。`;
    case "take_profit_review":
      return `${security}の終値${price}円が、あなたのルール「取得価格から${formatNumber(params.threshold ?? 0)}%上昇したら見直す」の条件を満たしました。ルールを確認してください。`;
    case "drawdown_from_high":
      return `${security}の終値${price}円が、あなたのルール「直近の高値から${formatNumber(params.threshold ?? 0)}%下落したら見直す」の条件を満たしました。ルールを確認してください。`;
    case "target_price_reached":
      return `${security}の終値${price}円が、あなたが設定した目標価格${formatNumber(params.targetPrice ?? 0)}円に到達しました。出口ルールを確認してください。`;
    case "cooldown_triggered":
      return `${security}は本日${formatNumber(params.dailyDropPercent ?? 0)}%下落しました。あなたのルールでは、急落日から${formatNumber(params.cooldownHours ?? 24)}時間は操作しないと決めています。ルールを確認してください。`;
  }
}

export function buildStalePriceAlertMessage(params: {
  companyName?: string | null;
  ticker: string;
  staleDays: number;
}) {
  return `${params.companyName ?? params.ticker} (${params.ticker})の価格が${params.staleDays}日間更新できていません。表示中の評価額は古い可能性があります。価格データと保有ルールを確認してください。`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
  }).format(value);
}
