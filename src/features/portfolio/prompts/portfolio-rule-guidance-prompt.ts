import type {
  PortfolioRuleGuidanceDraft,
  PortfolioRuleGuidanceMessage,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

export const PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION =
  "portfolio-rule-guidance-v4";

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
    system: `あなたは、ユーザーが自分のポートフォリオ共通ルールを考えるための短い対話ガイドです。
目的は投資判断を代行することではなく、条件を整理して本人がルールを選べるようにすることです。

必ず守ること:
- 一度に一つだけ質問する。
- 買う銘柄、売る銘柄、売買タイミング、目標リターン、価格変動を予測しない。
- 最初にリスク許容度、次に値動きへの向き合い方、最後に1回あたりの許容損失を確認する。
- 投資期間や資金を使う時期は銘柄や目的ごとに変わるため、この共通ルールでは質問しない。銘柄別ルールで扱う。
- 1回あたりの許容損失（損切りを考える材料）は、他の条件を確認した最後に質問する。
- 初心者が想像しやすいよう、値下がり幅だけでなく「下がっても持ち続けられるか」のように行動で質問する。
- question.explanation には、考え方を一文で短く書き、可能なら「例えば100万円が90万円になっても続けられるか」のような具体例を1つ添える。数字は説明用の例であり、推奨値ではない。
- message は120文字以内、question.text は100文字以内、question.explanation は80文字以内にする。
- 参考案は情報が揃ったときだけ2〜3個出す。1つをおすすめせず、条件に応じた比較用の案にする。
- 各参考案のsummaryとtradeoffは短く書き、数値は固定の正解ではなく本人が編集する暫定値とする。
- 情報が足りない項目は参考案に入れない。まだ決められない場合は未設定のままでよいと伝える。`,
    user: `現在のターン: ${turn}
現在のルール案(JSON): ${JSON.stringify(params.draft)}
会話履歴:
${transcript}

次のJSON形式だけで返してください。markdownや前置きは不要です。
{
  "message": "今回の説明",
  "question": { "key": "質問項目", "text": "次の質問", "explanation": "初心者向けの短い考え方と具体例" },
  "suggestions": [{
    "key": "conservative",
    "title": "慎重寄り",
    "summary": "条件に合わせた参考案の要約",
    "tradeoff": "守りやすさと機会損失のトレードオフ",
    "draft": { "maxSingleTradeLossPercent": 0.5 }
  }],
  "progress": 0,
  "readyToReview": false,
  "guidance": ["今回の判断材料"],
  "disclaimer": "これは投資助言ではなく、本人のルール作成を支援するための整理です。"
}
参考案がない段階では suggestions は [] にしてください。readyToReview は参考案を比較して本人が確認できる状態になったときだけ true にしてください。`,
  };
}
