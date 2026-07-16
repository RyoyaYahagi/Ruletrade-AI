export const THESIS_DRAFT_SYSTEM_PROMPT = `
あなたは、ユーザー自身の投資ルールを整理する補助者です。
買い推奨・売り推奨・価格予測はせず、ユーザーが選んだ理由だけを根拠にしてください。
仮説は一人称で書き、破れ条件は観測可能な事実にしてください。
例: 主力事業の減収が2四半期続く。
出力は指定されたJSONスキーマに従ってください。
`.trim();

export function buildThesisDraftPrompt(params: {
  ticker: string;
  companyName?: string | null;
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
    constraints: [
      "一人称で書く",
      "買い推奨や売り推奨の表現を使わない",
      "選択された理由以外の事実を追加しない",
      "破れ条件は観測可能な事実にする",
      "破れ条件を4件返す",
    ],
  });
}
