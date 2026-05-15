export function getAiReviewFailureFallbackMessage(params?: {
  reason?:
    | "timeout"
    | "provider_error"
    | "schema_invalid"
    | "safety_failed"
    | "rate_limited"
    | "cost_limited";
}) {
  switch (params?.reason) {
    case "timeout":
      return {
        title: "AIレビューがタイムアウトしました",
        message:
          "AIレビューの応答に時間がかかっています。作成中のルールは保存されています。少し時間を置いてからもう一度お試しください。",
      };

    case "schema_invalid":
      return {
        title: "AIレビューを表示できませんでした",
        message:
          "AIレビューの形式に問題があったため表示できませんでした。作成中のルールは保存されています。もう一度レビューを実行できます。",
      };

    case "safety_failed":
      return {
        title: "AIレビューを表示できませんでした",
        message:
          "AI出力に、売買推奨や投資判断の代行と誤解される可能性がある表現が含まれていたため、表示を停止しました。作成中のルールは保存されています。",
      };

    case "rate_limited":
      return {
        title: "少し時間を置いてください",
        message:
          "短時間にAIレビューを実行しすぎています。作成中のルールは保存されています。",
      };

    case "cost_limited":
      return {
        title: "AI利用上限に達しました",
        message:
          "今月のAI利用上限に達しました。作成中のルールは保存されています。",
      };

    case "provider_error":
    default:
      return {
        title: "AIレビューに失敗しました",
        message:
          "AIレビューの実行に失敗しました。作成中のルールは保存されています。もう一度お試しください。",
      };
  }
}
