export function getSafetyFallbackMessage() {
  return {
    title: "AIレビューを表示できませんでした",
    message:
      "AI出力に、売買推奨や投資判断の代行と誤解される可能性がある表現が含まれていたため、表示を停止しました。作成中のルールは保存されています。もう一度レビューを実行できます。",
  };
}
