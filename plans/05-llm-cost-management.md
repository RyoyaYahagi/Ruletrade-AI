# 05. LLM 利用料金の記録・可視化・上限管理の完成

## 目的

LLM 利用料金を「すべての AI 呼び出しで漏れなく記録し、ユーザーと管理者が見え、上限で止まる」状態にする。

**既にあるもの（再実装しないこと）**:

- `ai_run_logs` テーブルと記録機構: `src/lib/ai/logs/`（tokens・estimatedCostUsd・taskType・sourceType を記録）
- 月次コスト上限: `src/lib/cost-limit/check-ai-cost-limit.ts`（超過で `COST_LIMIT_EXCEEDED` 402）、
  `increment-ai-cost-usage.ts`、`cost_limit_counters` テーブル、デフォルト上限 $1/月
  （`DEFAULT_MONTHLY_AI_COST_LIMIT_USD`）
- モデル単価表: `model_pricing_configs` テーブルと `src/lib/ai/usage/estimate-cost.ts`

**足りないもの（この計画で作る）**:

1. 上限チェックと加算が一部のルート（rule review / watchlist review）にしか入っていない
   → 全 AI 呼び出しを共通ラッパー `runMeteredAiCall` に載せる
2. ユーザーが自分の利用額を見る画面がない → 設定ページに利用状況画面を追加
3. 80% 到達の事前警告がない → 通知 `ai_budget_warning`
4. 管理者が単価表と全体利用額を見る画面がない → 管理画面を追加

## 依存関係

なし。ただし計画 04・08・09 がこの計画の `runMeteredAiCall` を使うため、それらより先が望ましい。

## 最初に読むファイル

- `src/lib/cost-limit/` の全 4 ファイル（短い）
- `src/lib/ai/usage/estimate-cost.ts` と `token-usage.ts`
- `src/lib/ai/logs/ai-run-log-types.ts` と `with-ai-run-logging.ts`
- `src/app/api/rule-sessions/[sessionId]/review/route.ts`（現状の check→call→increment の並びを確認）
- `src/features/notifications/services/notification-service.ts`（通知作成の形式）
- `src/app/settings/` 配下の既存ページ 1 つ（設定画面の書き方）
- `src/app/api/admin/` 配下の既存ルート 1 つと `requireAdmin`

## やらないこと

- 課金・決済（billing 連携は別テーマ）
- モデル選択ロジックの変更（`ai-model-router.ts` は触らない）
- `ai_run_logs` のスキーマ変更

## データモデル

新テーブルは 1 つだけ。自動作成（初回 insert）でよい（unique 制約不要のため）:

- `user_ai_budget_settings`: `user_id`（unique 扱いはコードで 1 行維持）、
  `monthly_limit_usd`（real）、`warning_notified_period`（text、'YYYY-MM'。80% 通知の重複防止）

`cost_limit_counters.limit_cost_usd` は既存のまま使う。優先順位:
`user_ai_budget_settings.monthly_limit_usd` があればそれを、無ければ
`DEFAULT_MONTHLY_AI_COST_LIMIT_USD` を上限とする。
ユーザーが設定できる上限の最大値は定数 `MAX_USER_MONTHLY_LIMIT_USD = 10` とする
（`cost-limit-types.ts` に追加）。

## 実装ステップ

### ステップ 1: 共通ラッパー `runMeteredAiCall`

ファイル: `src/lib/cost-limit/run-metered-ai-call.ts`（新規）

```ts
import "server-only";

export type MeteredFeature =
  | "rule_review"
  | "watchlist_review"
  | "thesis_draft"       // 計画04
  | "news_classify"      // 計画08
  | "news_summarize"     // 計画08
  | "portfolio_review"
  | "holistic_review";   // 計画09

export async function runMeteredAiCall<T>(params: {
  userId: string;
  feature: MeteredFeature;
  estimatedCostUsd: number;   // 事前見積り。feature ごとの定数を渡す
  execute: () => Promise<{ result: T; actualCostUsd: number | undefined }>;
}): Promise<T>;
```

処理順:

1. `checkAiCostLimit({ userId, estimatedNextCostUsd: estimatedCostUsd })`
   （超過なら既存どおり `COST_LIMIT_EXCEEDED` が throw される）
2. `execute()` を実行（この中で `callAi` が呼ばれる。usage は callAi の戻りから取る）
3. `incrementAiCostUsage({ userId, costUsd: actualCostUsd ?? estimatedCostUsd })`
   — 実測が取れないプロバイダでは見積りで加算する（過小計上より過大計上を選ぶ。理由をコメントに書く）
4. 加算後の使用額が上限の 80% 以上なら、ステップ 3 の警告通知を 1 期間 1 回だけ作成する

feature ごとの見積り定数を `cost-limit-types.ts` に追加:

```ts
export const ESTIMATED_AI_COST_USD: Record<MeteredFeature, number> = {
  rule_review: 0.05,       // 既存の ESTIMATED_AI_RULE_REVIEW_COST_USD を統合
  watchlist_review: 0.05,
  thesis_draft: 0.02,
  news_classify: 0.002,
  news_summarize: 0.02,
  portfolio_review: 0.05,
  holistic_review: 0.10,
};
```

### ステップ 2: 既存ルートの載せ替え

- `src/app/api/rule-sessions/[sessionId]/review/route.ts` と
  `src/app/api/watchlist/review/route.ts` の check→call→increment を
  `runMeteredAiCall` に置き換える。挙動は変えない（テストで担保）。

### ステップ 3: 80% 警告通知

`runMeteredAiCall` 内で加算後に判定:

- 条件: `usedCostUsd / limitCostUsd >= 0.8` かつ
  `user_ai_budget_settings.warning_notified_period` が今月（'YYYY-MM'）でない
- 通知作成: `notification_type: "ai_budget_warning"`、本文は
  「今月の AI 利用額が上限の 80% に達しました（$X.XX / $Y.YY）。上限は設定画面で変更できます。」
- 作成後に `warning_notified_period` を今月に更新する

### ステップ 4: 利用状況 API（ユーザー向け）

ファイル: `src/app/api/ai-usage/summary/route.ts`（新規、GET）

- `requireUser()`。レスポンス:

```json
{
  "period": { "start": "...", "end": "..." },
  "usedCostUsd": 0.42,
  "limitCostUsd": 1.0,
  "remainingCostUsd": 0.58,
  "byFeature": [
    { "taskType": "rule_review", "callCount": 8, "costUsd": 0.31 }
  ]
}
```

- `usedCostUsd` / `limitCostUsd` は `cost_limit_counters` から。
- `byFeature` は `ai_run_logs` を `user_id` + 今月期間で絞り、`task_type` ごとに
  `count` と `estimated_cost_usd` 合計を集計する（列名は `save-ai-run-log.ts` を読んで確認）。
- **所有権**: 必ず `.eq("user_id", user.id)` で絞る。

ファイル: `src/app/api/ai-usage/settings/route.ts`（新規、GET / PUT）

- PUT ボディ: `{ "monthlyLimitUsd": 3 }`。zod で `z.number().min(0.1).max(MAX_USER_MONTHLY_LIMIT_USD)`。
- `user_ai_budget_settings` を upsert（1 ユーザー 1 行）。

### ステップ 5: 設定画面（ユーザー向け）

ファイル: `src/app/settings/ai-usage/page.tsx`（新規）+
`src/features/ai/components/ai-usage-panel.tsx`（新規）

表示内容（`src/app/settings/` の既存ページの構造・スタイルに合わせる）:

1. 今月の利用額と上限（プログレスバー。80% 以上で警告色）
2. 機能別の内訳テーブル（回数と金額）
3. 月間上限の変更フォーム（$0.1〜$10）
4. 説明文: 「上限に達すると AI 機能（下書き生成・レビュー・ニュース要約）は翌月まで停止します。
   価格の自動取得やルール条件の通知は AI を使わないため、停止しません。」
   — この一文は初心者の不安（勝手に課金が増える）への回答なので必ず入れる。

### ステップ 6: 管理者画面

ファイル: `src/app/api/admin/ai-usage/route.ts`（新規、GET）
- `requireAdmin()`。全ユーザーの今月合計・ユーザー別上位 20 件・feature 別合計を返す。

ファイル: `src/app/api/admin/model-pricing/route.ts`（新規、GET / POST）
- `model_pricing_configs` の一覧と追加。POST ボディ:
  `{ provider, model, inputCostPer1mTokensUsd, outputCostPer1mTokensUsd, effectiveFrom }`。
  追加時は同 (provider, model) の既存行の `is_active` を 0 に更新してから insert する
  （estimate-cost.ts が `is_active` + `effective_from` 降順で 1 件取る実装のため）。

ファイル: `src/app/admin/` 配下に上記を表示する管理ページを 1 枚追加
（既存 admin ページの構造をコピーする）。

## テスト

置き場所: `tests/features/ai-usage/`（新規）

必須ケース:

1. `runMeteredAiCall`: 上限超過時に `execute` が**呼ばれない**（402 が先に出る）
2. `runMeteredAiCall`: 成功時に `cost_limit_counters.used_cost_usd` が実測コスト分増える
3. `runMeteredAiCall`: `actualCostUsd` が undefined のとき見積り額で加算される
4. 80% 到達で `ai_budget_warning` 通知が作成され、同月 2 回目は作成されない
5. summary API: 他ユーザーの利用額が混ざらない（ユーザー A の集計にユーザー B のログが出ない）（**所有権テスト**）
6. settings PUT: 上限 $10 超・$0.1 未満が 400 になる
7. admin API: 一般ユーザーで叩くと 403 になる
8. model-pricing POST: 同一モデルの旧行が `is_active = 0` になり、`estimateAiCostUsd` が新単価を使う

## 完了条件

- [ ] すべての既存 AI ルートが `runMeteredAiCall` 経由になっている
- [ ] 設定画面で自分の今月利用額・内訳・上限変更ができる
- [ ] 80% 警告通知が月 1 回だけ届く
- [ ] 管理者が単価表を更新でき、以後のコスト見積りに反映される
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
