import type { ErrorCode } from "@/lib/errors/error-codes";

export function getUserFacingErrorMessage(code: ErrorCode) {
  switch (code) {
    case "VALIDATION_ERROR":
      return "入力内容を確認してください。";

    case "UNAUTHORIZED":
      return "ログインが必要です。";

    case "FORBIDDEN":
    case "NOT_FOUND":
      return "対象のデータが見つかりません。";

    case "AI_PROVIDER_TIMEOUT":
      return "AIレビューの応答に時間がかかっています。作成中のルールは保存されています。もう一度お試しください。";

    case "AI_PROVIDER_ERROR":
      return "AIレビューに失敗しました。作成中のルールは保存されています。もう一度お試しください。";

    case "AI_OUTPUT_INVALID":
      return "AIレビューの形式に問題があったため表示できませんでした。作成中のルールは保存されています。";

    case "SAFETY_FAILED":
      return "AI出力に安全性の問題があったため表示を停止しました。作成中のルールは保存されています。";

    case "RATE_LIMITED":
      return "短時間にAIレビューを実行しすぎています。少し時間を置いてからお試しください。";

    case "COST_LIMIT_EXCEEDED":
      return "今月のAI利用上限に達しました。作成中のルールは保存されています。";

    default:
      return "予期しないエラーが発生しました。";
  }
}
