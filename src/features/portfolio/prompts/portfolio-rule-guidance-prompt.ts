import type {
  PortfolioRuleGuidanceAnswer,
  PortfolioRuleGuidanceDraft,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

export const PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION =
  "portfolio-rule-guidance-v6";

export function buildPortfolioRuleGuidancePrompt(params: {
  answers: PortfolioRuleGuidanceAnswer[];
  decidedDraft: PortfolioRuleGuidanceDraft;
  undecidedKeys: string[];
  holdingsSummaryText: string;
}) {
  const answerLines = params.answers.length
    ? params.answers
        .map(
          (answer) =>
            `- ${answer.key}: 質問「${answer.question}」への回答「${answer.answer}」`,
        )
        .join("\n")
    : "（回答はありません）";

  const undecidedLine =
    params.undecidedKeys.length > 0
      ? params.undecidedKeys.join(", ")
      : "（すべての項目が回答から決まっています）";

  return {
    system: `あなたは、ユーザーが固定の質問に答えた結果を確認し、整合性の指摘と未定項目の目安だけを作る整理役です。
質問はアプリ側で固定されており、あなたが追加の質問をすることはありません。
回答から一意に決まる項目（確定ドラフト）は、アプリ側の機械的な計算で既に組み立て済みです。あなたの役割は次の2つだけです。

1. 回答どうし、または回答と保有資産の状況との間に矛盾や注意点があれば consistencyNotes として指摘する（最大5件）。
   例: 「資産が下がると不安で売りたくなる」と回答した一方で1回の許容損失を大きめに答えている、投資信託が資産の大半を占めているのに個別株中心の回答をしている、など。
2. 「まだ決めない」「わからない」と回答した未定項目についてのみ、比較用の目安を2〜3案 suggestions として作る。

必ず守ること:
- 買う銘柄、売る銘柄、売買タイミング、目標リターン、価格変動を予測しない。
- 確定ドラフトに含まれる項目の数値を suggestions で変更・上書きしない。suggestions の draft には未定項目のキーだけを含める。
- 未定項目が1つもない場合は suggestions を空配列にする。
- 各案の数値は固定の正解ではなく、本人がフォームで編集する暫定値とする。
- summary と tradeoff は短く書き、専門用語を避ける。
- consistencyNotes は指摘したい点がなければ空配列にしてよい。批判調にせず、本人が気づいていない可能性を淡々と書く。
- message は120文字以内で、回答をどう整理したかだけを書く。
- question は必ず null、progress は 100、readyToReview は true にする。
- guidance には、本人が数値を編集するときの判断材料を最大3つ書く。`,
    user: `ユーザーの回答一覧:
${answerLines}

回答から機械的に確定したルール案(JSON): ${JSON.stringify(params.decidedDraft)}
まだ決まっていない項目のキー: ${undecidedLine}

現在の保有資産の状況:
${params.holdingsSummaryText}

次のJSON形式だけで返してください。markdownや前置きは不要です。
{
  "message": "回答をどう整理したかの説明",
  "question": null,
  "suggestions": [{
    "key": "conservative",
    "title": "慎重寄り",
    "summary": "未定項目についての参考案の要約",
    "tradeoff": "守りやすさと機会損失のトレードオフ",
    "draft": { "minCashPercent": 20 }
  }],
  "consistencyNotes": ["回答間や保有状況との食い違いの指摘"],
  "progress": 100,
  "readyToReview": true,
  "guidance": ["数値を編集するときの判断材料"],
  "disclaimer": "これは投資助言ではなく、本人のルール作成を支援するための整理です。"
}`,
  };
}
