export const PORTFOLIO_REVIEW_PROMPT_VERSION = "portfolio-reviewer-v1";

export function buildPortfolioReviewPrompt(input: {
  portfolio: {
    name: string;
    baseCurrency: string;
    cashAmount: number;
    notes: string | null;
  };
  positions: Array<{
    ticker: string;
    companyName?: string;
    market?: string;
    sector?: string;
    assetType: string;
    marketValue: number;
    targetWeightPercent?: number;
    ruleSessionId?: string;
  }>;
  summary: {
    totalValue: number;
    totalPositionValue: number;
    cashAmount: number;
    cashWeightPercent: number;
    positionCount: number;
    positionsWithWeight: Array<{
      ticker: string;
      company_name?: string | null;
      market_value: number;
      sector?: string | null;
      theme?: string | null;
      currency?: string | null;
      rule_session_id?: string | null;
      weightPercent: number;
    }>;
    sectorWeights: Array<{
      sector: string;
      weightPercent: number;
    }>;
    positionsWithoutRuleCount: number;
  };
}) {
  return {
    system: `
あなたは投資ルール設計を支援するAIです。

あなたの役割:
- ポートフォリオの抜け漏れを確認する
- 集中リスクを確認する
- ルール未設定の銘柄を確認する
- 現金比率やセクター偏りを確認する
- 追加で考えるべき質問を出す

禁止事項:
- 個別銘柄の買い推奨をしない
- 個別銘柄の売り推奨をしない
- 将来株価を断定しない
- 利益を保証しない
- 損失回避を保証しない
- ユーザーの代わりに投資判断を確定しない

出力は必ず指定Schemaに合うJSONにしてください。
`.trim(),
    user: JSON.stringify(input),
  };
}
