"use client";

export function AiErrorPanel({
  error,
}: {
  error: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}) {
  const message = getAiErrorMessage(error.code);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="font-semibold text-amber-900">{message.title}</h3>
      <p className="mt-2 text-sm text-amber-800">{message.body}</p>

      {error.requestId ? (
        <p className="mt-3 text-xs text-amber-700">
          requestId: {error.requestId}
        </p>
      ) : null}
    </div>
  );
}

function getAiErrorMessage(code?: string) {
  switch (code) {
    case "SAFETY_FAILED":
      return {
        title: "AIレビューを表示できませんでした",
        body: "AI出力に、売買推奨や投資判断の代行と誤解される可能性がある表現が含まれていたため、表示を停止しました。作成中のルールは保存されています。",
      };

    case "RATE_LIMITED":
      return {
        title: "少し時間を置いてください",
        body: "短時間にAIレビューを実行しすぎています。作成中のルールは保存されています。",
      };

    case "COST_LIMIT_EXCEEDED":
      return {
        title: "AI利用上限に達しました",
        body: "今月のAI利用上限に達しました。作成中のルールは保存されています。",
      };

    case "AI_OUTPUT_INVALID":
      return {
        title: "AIレビューの形式に問題があります",
        body: "AIレビューの形式に問題があったため表示できませんでした。作成中のルールは保存されています。",
      };

    default:
      return {
        title: "AIレビューに失敗しました",
        body: "AIレビューの実行に失敗しました。作成中のルールは保存されています。もう一度お試しください。",
      };
  }
}
