import type { AITaskType } from "@/lib/ai/provider";
import { DOCUMENT_SUMMARY_PROMPT_VERSION } from "@/features/documents/prompts/document-summary-prompt";
import { HOLISTIC_REVIEW_PROMPT_VERSION } from "@/features/portfolio/prompts/holistic-review-prompt";
import { PORTFOLIO_REVIEW_PROMPT_VERSION } from "@/features/portfolio/prompts/portfolio-review-prompt";
import { PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION } from "@/features/portfolio/prompts/portfolio-rule-guidance-prompt";
import { WATCHLIST_ITEM_REVIEW_PROMPT_VERSION } from "@/features/watchlist/prompts/watchlist-item-review-prompt";
import { WATCHLIST_REVIEW_PROMPT_VERSION } from "@/features/watchlist/prompts/watchlist-review-prompt";

export type AiPromptCatalogEntry = {
  version: string;
  taskType: AITaskType;
  label: string;
  purpose: string;
  sourcePath: string;
};

export const AI_PROMPT_CATALOG: AiPromptCatalogEntry[] = [
  {
    version: "rule-reviewer-v1",
    taskType: "rule_review",
    label: "ルールレビュー",
    purpose: "作成したルールの抜け・矛盾・リスクを点検する",
    sourcePath: "src/features/rules/services/rule-review-service.ts",
  },
  {
    version: "thesis-draft-v1",
    taskType: "rule_draft_generation",
    label: "仮説ドラフト",
    purpose: "調査結果を投資ルールの確認用ドラフトに整理する",
    sourcePath: "src/features/rules/services/thesis-draft-service.ts",
  },
  {
    version: PORTFOLIO_REVIEW_PROMPT_VERSION,
    taskType: "portfolio_review",
    label: "ポートフォリオレビュー",
    purpose: "保有状況と登録ルールの抜け漏れを確認する",
    sourcePath: "src/features/portfolio/prompts/portfolio-review-prompt.ts",
  },
  {
    version: HOLISTIC_REVIEW_PROMPT_VERSION,
    taskType: "holistic_review",
    label: "月次レビュー",
    purpose: "月次の事実と本人のルールの整合を確認する",
    sourcePath: "src/features/portfolio/prompts/holistic-review-prompt.ts",
  },
  {
    version: PORTFOLIO_RULE_GUIDANCE_PROMPT_VERSION,
    taskType: "portfolio_rule_guidance",
    label: "ポートフォリオルール整理",
    purpose: "固定質問への回答から未定項目と整合性を整理する",
    sourcePath: "src/features/portfolio/prompts/portfolio-rule-guidance-prompt.ts",
  },
  {
    version: WATCHLIST_REVIEW_PROMPT_VERSION,
    taskType: "watchlist_review",
    label: "ウォッチリストレビュー",
    purpose: "ウォッチリストの仮説と確認条件を点検する",
    sourcePath: "src/features/watchlist/prompts/watchlist-review-prompt.ts",
  },
  {
    version: WATCHLIST_ITEM_REVIEW_PROMPT_VERSION,
    taskType: "watchlist_review",
    label: "ウォッチリスト項目レビュー",
    purpose: "1銘柄分の準備度と不足している確認事項を点検する",
    sourcePath: "src/features/watchlist/prompts/watchlist-item-review-prompt.ts",
  },
  {
    version: DOCUMENT_SUMMARY_PROMPT_VERSION,
    taskType: "document_summary",
    label: "資料要約",
    purpose: "資料からルール設計に関係する事実と確認事項を抽出する",
    sourcePath: "src/features/documents/prompts/document-summary-prompt.ts",
  },
];
