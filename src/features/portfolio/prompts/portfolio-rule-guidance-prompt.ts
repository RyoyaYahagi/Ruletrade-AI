import type {
  PortfolioRuleGuidanceDraft,
  PortfolioRuleGuidanceMessage,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

export const PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION =
  "portfolio-rule-guidance-v1";

export function buildPortfolioRuleGuidancePrompt(params: {
  history: PortfolioRuleGuidanceMessage[];
  draft: PortfolioRuleGuidanceDraft;
}) {
  const turn = params.history.filter((message) => message.role === "user").length;
  const transcript = params.history.length
    ? params.history
        .map((message) => `${message.role === "user" ? "ユーザー" : "AI"}: ${message.content}`)
        .join("\n")
    : "（まだ会話はありません）";

  return {
    system: `あなたは、ユーザーが自分のポートフォリオ共通ルールを考えるための学習ガイドです。
目的は投資判断を代行することではなく、ユーザーの目的・制約・許容できる偏りを整理し、本人がルールを選べるようにすることです。

必ず守ること:
- 一度に一つだけ質問する。
- 買う銘柄、売る銘柄、売買タイミング、目標リターン、価格変動を予測しない。
- 数値は断定的な正解ではなく、ユーザーの回答から考えられる参考候補として提示する。
- 情報が足りない項目は suggestion に入れない。
- message と question は日本語で、具体的な理由とトレードオフを短く説明する。
- 3〜4往復で、最大比率・現金比率・許容損失・必要なら資産配分を整理する。
- まだ決められない場合も問題ないと伝え、未設定のまま保存できることを示す。`,
    user: `現在のターン: ${turn}
現在のルール案(JSON): ${JSON.stringify(params.draft)}
会話履歴:
${transcript}

次のJSON形式だけで返してください。markdownや前置きは不要です。
{
  "message": "今回の説明",
  "question": { "key": "質問項目", "text": "次の質問", "explanation": "考え方の補足" },
  "suggestion": {
    "maxPositionPercent": 0,
    "maxSectorPercent": 0,
    "maxThemePercent": 0,
    "minCashPercent": 0,
    "maxSingleTradeLossPercent": 0,
    "targetAllocations": [{ "key": "stock", "targetPercent": 0, "tolerancePercent": 5 }],
    "notes": ""
  },
  "progress": 0,
  "readyToReview": false,
  "guidance": ["今回の判断材料"],
  "disclaimer": "これは投資助言ではなく、本人のルール作成を支援するための整理です。"
}
数値がまだ決まっていない項目は suggestion から省略してください。readyToReview は主要な候補が揃い、フォームへ反映して本人が確認できる状態になったときだけ true にしてください。`,
  };
}
