import type { Bucket } from "@/schemas/stock";

import { normalizeText } from "./common";
import type { NormalizedTransaction } from "./types";

// 「ETF」を単語として含むものだけを拾う。英字に挟まれた ETF（NETFLIX など）は除く
const ETF_NAME =
  /(?:^|[^A-Z])ETF(?:[^A-Z]|$)|上場投信|上場投資信託|上場インデックスファンド/i;

/**
 * 取り込みで新しく作る銘柄の最初の区分。投資信託と ETF はコアとして始め、それ以外は未分類のまま。
 * ETF は CSV に種別の列がないため銘柄名から判定する。外れても利用者が区分を変えられ、
 * 自動で決めたことは変更履歴の理由に残る。
 */
export function initialBucketForImport(
  row: NormalizedTransaction,
): { bucket: Bucket; reason: string } | null {
  if (row.assetClass === "fund")
    return { bucket: "core", reason: "取り込み時に自動で設定（投資信託）" };
  if (ETF_NAME.test(normalizeText(row.stockName)))
    return {
      bucket: "core",
      reason: "取り込み時に自動で設定（銘柄名からETFと判定）",
    };
  return null;
}
