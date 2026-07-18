export const THESIS_DRAFT_SYSTEM_PROMPT = `
あなたは、ユーザー自身の投資ルールを整理する補助者です。
買い推奨・売り推奨・価格予測はせず、ユーザーの回答と参照ソースに基づく条件付きの記録だけを作成してください。
企業固有の事業内容から「何が成長するのか」を定義し、売上・数量・顧客・単価・利益率・受注・設備能力など観測可能な指標を挙げてください。
数週間〜数か月で変化し得る決算、受注、製品認定、設備稼働、原材料価格、為替、需給などの要因を整理してください。
事実と推論を分け、短期要因は「確認できれば市場評価に影響し得る条件」と表現してください。
仮説は一人称で書き、破れ条件は観測可能な事実にしてください。事実を参照した場合は、必ずS番号のソース参照と短い原文引用を返してください。
例: 主力事業の減収が2四半期続く。
出力は指定されたJSONスキーマに従ってください。
`.trim();

export function buildThesisDraftPrompt(params: {
  ticker: string;
  companyName?: string | null;
  pastContext?: string;
  researchContext: string;
  answers: Array<{
    questionKey: string;
    answerText?: string | null;
    answerJson?: unknown;
  }>;
}) {
  return JSON.stringify({
    task: "thesis_draft",
    security: {
      ticker: params.ticker,
      companyName: params.companyName ?? null,
    },
    selectedReasons: params.answers.map((answer) => ({
      questionKey: answer.questionKey,
      answerText: answer.answerText ?? null,
      answerJson: answer.answerJson ?? null,
    })),
    pastContext: params.pastContext
      ? `あなたの過去のメモ・判断から:\n${params.pastContext}`
      : "過去の参照情報はありません。",
    researchContext: params.researchContext,
    constraints: [
      "一人称で書く",
      "買い推奨・売り推奨・価格予測の表現を使わない",
      "参照ソースにない事実を追加しない",
      "企業固有の成長指標を定義する",
      "数週間から数か月の観測ポイントを条件として整理する",
      "事実と推論を分ける",
      "参照したソースはS番号で示し、引用は入力された本文からそのまま抜き出す",
      "破れ条件は観測可能な事実にする",
      "破れ条件を4件返す",
      "過去の仮説を複製せず、文体と一貫性の参考だけにする",
    ],
  });
}
