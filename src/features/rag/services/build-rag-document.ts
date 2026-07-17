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

export function buildAlertResolutionRagContent(params: {
  quoteDate: string;
  ticker: string;
  conditionKey: string;
  resolution: "kept" | "revising";
}) {
  return `${params.quoteDate} ${params.ticker} の条件「${params.conditionKey}」成立に対し、ユーザーは「${params.resolution === "kept" ? "ルールを維持" : "ルールを見直す"}」を選びました。これはユーザー自身の過去の判断記録です。`;
}

export function buildNewsAssessmentRagContent(params: {
  publishedAt: string;
  ticker: string;
  title: string;
  thesis: string;
  thesisRelation?: string | null;
  summary?: string | null;
}) {
  return [
    `${params.publishedAt} ${params.ticker}: ${params.title}`,
    `仮説「${params.thesis.slice(0, 100)}」への関係: ${params.thesisRelation ?? "未分類"}`,
    params.summary ? `要約: ${params.summary}` : null,
    "これはユーザーのルールに対する過去の判定記録です。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildHolisticReviewRagContent(params: {
  period: string;
  summaryText: string;
  findings: Array<{
    category: string;
    status: string;
    message: string;
    relatedSymbols?: string[];
  }>;
}) {
  return [
    `月次レビュー ${params.period}`,
    `総括: ${params.summaryText}`,
    ...params.findings.map((finding) =>
      [
        `確認項目: ${finding.category} (${finding.status})`,
        finding.message,
        finding.relatedSymbols?.length
          ? `関連銘柄: ${finding.relatedSymbols.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("。"),
    ),
    "これはユーザーの登録情報と過去のルール確認結果です。",
  ].join("\n");
}
