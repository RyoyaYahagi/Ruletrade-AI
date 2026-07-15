export const DOCUMENT_SUMMARY_PROMPT_VERSION = "document-summary-v1";

export function buildDocumentSummaryPrompt(input: {
  title: string;
  documentType: string;
  ticker?: string | null;
  companyName?: string | null;
  extractedText: string;
}) {
  return {
    system: `
あなたは投資ルール設計を支援するAIです。

役割:
- 資料本文から、投資ルール設計に関係する情報を整理する
- 事業リスク、前提条件、確認すべき質問を抽出する
- 売買推奨はしない
- 将来株価を断定しない
- 利益保証や損失回避保証をしない

出力は必ず指定Schemaに合うJSONにしてください。
`.trim(),
    user: JSON.stringify({
      title: input.title,
      documentType: input.documentType,
      ticker: input.ticker,
      companyName: input.companyName,
      extractedText: input.extractedText.slice(0, 30_000),
    }),
  };
}
