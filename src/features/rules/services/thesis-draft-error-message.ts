export function getThesisDraftStreamErrorNotice(code?: string) {
  switch (code) {
    case "AI_PROVIDER_TIMEOUT":
      return "AI下書きの生成がタイムアウトしました。しばらく待ってから再読み込みしてください。";
    case "AI_OUTPUT_INVALID":
      return "AIが必要な構造化形式で返答しなかったため、下書きを作成できませんでした。";
    case "AI_PROVIDER_ERROR":
      return "AI下書きの生成に失敗しました。しばらく待ってから再読み込みしてください。";
    default:
      return null;
  }
}
