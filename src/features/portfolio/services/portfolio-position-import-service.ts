import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { callAi } from "@/lib/ai/provider-gateway";
import {
  PortfolioPositionImageImportSchema,
  type PortfolioPositionImportItem,
} from "@/schemas/portfolio/portfolio-position-import-schema";

const IMPORT_PROMPT = `
添付された投資口座の保有銘柄一覧画像から、現在保有している商品だけを抽出してください。

必ず次のルールに従ってください。
- 個別株は assetType を stock、投資信託は assetType を fund にする。ETF、REIT、現金類似商品も画面の表示に合わせる。
- 投資信託に銘柄コードが表示されていない場合は ticker を省略し、ファンド名を companyName に入れる。
- ticker は画面に表示された銘柄コード・ファンドコードをそのまま使う。コードがないものを推測しない。
- companyName は画面の正式名称を省略せずに入れる。
- marketValue は評価額、quantity は保有数量、averageCost は平均取得単価、currentPrice は現在価格として読み取る。読めない数値は省略する。
- 数値はカンマや通貨記号を除いた数値にする。損益額や損益率を marketValue に入れない。
- 日本の口座画面は market=JP、currency=JPY を基本にする。米国商品は画面から判断できる場合だけ market=US、currency=USD にする。
- 同じ商品が複数画像に写っている場合は一つにまとめ、より情報量の多い行を採用する。
- 画像にない銘柄を補完・推測しない。投資判断や売買提案は出力しない。
- 読み取りに自信がない行は confidence=low とし、extractionNote に確認点を書く。
`;

export async function extractPortfolioPositionsFromImages(params: {
  userId: string;
  requestId?: string;
  images: Array<{
    fileName: string;
    mimeType: string;
    data: Buffer;
  }>;
}) {
  const result = await callAi({
    weight: "heavy",
    taskType: "portfolio_position_import",
    agentName: "portfolio_import_agent",
    system:
      "あなたは投資口座の明細画像を構造化する抽出エージェントです。画像に書かれている事実だけを返してください。",
    prompt: IMPORT_PROMPT,
    outputSchema: PortfolioPositionImageImportSchema,
    schemaName: "PortfolioPositionImageImport",
    temperature: 0.1,
    maxTokens: 4096,
    userId: params.userId,
    requestId: params.requestId,
    sourceType: "portfolio",
    inputJson: {
      fileNames: params.images.map((image) => image.fileName),
      imageCount: params.images.length,
    },
    images: params.images.map((image) => ({
      data: image.data.toString("base64"),
      mimeType: image.mimeType,
      detail: "high" as const,
    })),
  });

  if (!result.ok) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "画像から保有銘柄を読み取れませんでした。画像対応のAI Provider設定を確認してください。",
      502,
      result.error,
      true,
    );
  }

  return {
    positions: result.data.positions as PortfolioPositionImportItem[],
    notes: result.data.notes,
  };
}
