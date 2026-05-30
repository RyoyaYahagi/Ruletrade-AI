import "server-only";

export function buildRuleSessionRagContent(session: {
  ticker: string;
  company_name?: string | null;
  rule_json?: Record<string, unknown> | null;
  completion_score?: number | null;
  status?: string | null;
}) {
  const rule = session.rule_json ?? {};

  return [
    `銘柄: ${session.ticker}`,
    session.company_name ? `銘柄名: ${session.company_name}` : null,
    `ステータス: ${session.status ?? "unknown"}`,
    `完成度スコア: ${session.completion_score ?? "未評価"}`,
    rule.investmentThesis ? `投資理由: ${rule.investmentThesis}` : null,
    rule.timeHorizon ? `投資期間: ${rule.timeHorizon}` : null,
    rule.entryPlan ? `買付計画: ${JSON.stringify(rule.entryPlan)}` : null,
    rule.riskManagement
      ? `リスク管理: ${JSON.stringify(rule.riskManagement)}`
      : null,
    rule.exitPlan ? `出口条件: ${JSON.stringify(rule.exitPlan)}` : null,
    rule.earningsPolicy
      ? `決算方針: ${JSON.stringify(rule.earningsPolicy)}`
      : null,
    rule.freeNotes ? `メモ: ${rule.freeNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildWatchlistItemRagContent(item: {
  ticker: string;
  company_name?: string | null;
  interest_reason?: string | null;
  target_price_min?: number | null;
  target_price_max?: number | null;
  planned_tranches?: number | null;
  target_multiple?: number | null;
  max_position_percent?: number | null;
  stop_loss_note?: string | null;
  take_profit_note?: string | null;
  research_notes?: string | null;
}) {
  return [
    `銘柄: ${item.ticker}`,
    item.company_name ? `銘柄名: ${item.company_name}` : null,
    item.interest_reason ? `気になる理由: ${item.interest_reason}` : null,
    `買いたい価格帯: ${item.target_price_min ?? "未設定"} 〜 ${
      item.target_price_max ?? "未設定"
    }`,
    item.planned_tranches ? `分割購入予定: ${item.planned_tranches}回` : null,
    item.target_multiple ? `目標倍率: ${item.target_multiple}` : null,
    item.max_position_percent
      ? `最大投資比率: ${item.max_position_percent}%`
      : null,
    item.stop_loss_note ? `損切りメモ: ${item.stop_loss_note}` : null,
    item.take_profit_note ? `利確メモ: ${item.take_profit_note}` : null,
    item.research_notes ? `調査メモ: ${item.research_notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPortfolioPositionRagContent(position: {
  ticker: string;
  company_name?: string | null;
  sector?: string | null;
  theme?: string | null;
  market_value?: number | null;
  target_weight_percent?: number | null;
  memo?: string | null;
  rule_session_id?: string | null;
}) {
  return [
    `銘柄: ${position.ticker}`,
    position.company_name ? `銘柄名: ${position.company_name}` : null,
    position.sector ? `セクター: ${position.sector}` : null,
    position.theme ? `テーマ: ${position.theme}` : null,
    position.market_value ? `時価総額: ${position.market_value}` : null,
    position.target_weight_percent
      ? `目標ウェイト: ${position.target_weight_percent}%`
      : null,
    position.memo ? `メモ: ${position.memo}` : null,
    position.rule_session_id
      ? `ルールセッションID: ${position.rule_session_id}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
