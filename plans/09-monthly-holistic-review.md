# 09. 月次総合レビュー（リスク許容度×資産×ルール）

## 目的

月に 1 回、ユーザーの investment memory（リスク許容度・制約）、ポートフォリオ、
全ルールを突き合わせた総合レビューを自動生成し、通知する。
頻度が低い（月 1）ので `taskWeight: "heavy"` の LLM を使ってよい。

出力は**指摘と確認のみ**。例:

- 「リスク許容度は conservative ですが、値動きの大きい銘柄が資産の 40% を占めています」
- 「保有 5 銘柄のうち 2 銘柄に出口ルールがありません」
- 「『レバレッジ商品は持たない』という制約に反する保有はありません」（守れている確認も出す）

最後の例が重要: **問題ゼロでも「守れている」ことを伝える**。安心の提供もこの機能の価値。

## 依存関係

- 計画 05（`runMeteredAiCall`、feature: `holistic_review`）が先。
- 計画 02（価格）があれば評価額の精度が上がるが、無くても手動入力値で動くこと。

## 最初に読むファイル

- `src/features/portfolio/services/portfolio-review-service.ts`
  （既存の AI ポートフォリオレビュー。**この計画の最重要参照**。
  プロンプト構成・safety の通し方・保存形式をすべて踏襲する）
- `src/features/portfolio/prompts/`（既存プロンプトの書き方）
- `src/app/api/investment-memory/route.ts` と対応サービス
- `src/features/rules/services/rule-session-service.ts`（全ルールの取得）

## やらないこと

- 具体的な売買・リバランス提案
- 「あなたに最適な配分は X%」という個別最適の断定
- 週次への短縮（まず月次。頻度はあとで設定化する）

## データモデル

自動作成（初回 insert）でよい:

- `holistic_reviews`: `user_id`, `period`（'YYYY-MM'）, `review_json`（構造化された指摘リスト）,
  `summary_text`, `model`, `estimated_cost_usd`, `safety_passed`, `notification_id`
- 同一 (user_id, period) の重複実行はコードで防ぐ（実行前に select して存在したらスキップ）。

`review_json` のスキーマ（zod で定義し、LLM 出力をこれで受ける）:

```ts
z.object({
  findings: z.array(z.object({
    category: z.enum([
      "risk_tolerance_mismatch",   // リスク許容度との不整合
      "missing_rule",              // ルールが無い保有銘柄
      "missing_exit",              // 出口条件の欠落
      "concentration",             // 集中
      "constraint_check",          // standing_constraints の充足確認（OK報告を含む）
      "stale_rule",                // 長期間レビューされていないルール
    ]),
    status: z.enum(["ok", "attention"]),   // ok = 守れている報告
    message: z.string().max(300),
    relatedSymbols: z.array(z.string()).max(20).default([]),
  })).max(20),
  overallNote: z.string().max(500),
})
```

## 実装ステップ

### ステップ 1: 入力データの収集（決定的）

ファイル: `src/features/portfolio/services/holistic-review-service.ts`（新規）

LLM に渡す前に、決定的コードで事実を計算しておく（LLM に計算させない）:

- 銘柄ごとの比率（%）、現金比率
- ルールの有無（承認済みセッションと保有銘柄の突き合わせ）
- 各ルールの出口条件・監視設定の有無（`TradeRuleSchema` parse 結果から）
- 最終レビュー日（`rule_design_sessions.last_reviewed_at`）から 90 日超のルール一覧
- investment memory の全フィールド

これらを JSON でプロンプトに埋め、LLM の役割は
「事実を初心者に伝わる日本語の指摘文に変換し、リスク許容度との整合を評価する」に限定する。
比率計算などの数値が LLM 出力に混ざった場合に備え、
**数値はプロンプトで渡した値のみ使うよう指示**し、出力の relatedSymbols が
実在の保有銘柄かをコードで検証する（実在しないものは除外）。

### ステップ 2: 生成と保存

- `runMeteredAiCall({ feature: "holistic_review", estimatedCostUsd: ESTIMATED_AI_COST_USD.holistic_review })`
- `callAi({ taskWeight: "heavy" })`、出力は上記 zod スキーマで受ける。パース失敗はエラー
  （その月は未生成のまま。翌日の cron 再実行で再試行される設計にする）。
- `summary_text` と各 `message` を `safety-check-service` に通す。
- 保存後、notification_type: `holistic_review_ready` で通知
  「今月のポートフォリオとルールの総合レビューができました。確認してください。」

### ステップ 3: cron

ファイル: `src/app/api/cron/reviews/monthly/route.ts`（新規）

- `assertValidCronRequest`。毎日実行し、コード内で「今月分が未生成のユーザー」だけ処理する
  （月初 1 回だけの cron 設定より、失敗時リトライが単純になるため。理由をコメントに書く）。
- 対象: `notification_preferences.in_app_enabled = true` かつポジションが 1 件以上あるユーザー。
- 1 回の実行での生成上限 `MAX_REVIEWS_PER_RUN = 50`（定数）。
- ユーザーのコスト上限超過（402）はそのユーザーをスキップして続行し、
  レスポンスに `skippedForBudget` 数を含める。

### ステップ 4: 表示画面

ファイル: `src/app/portfolio/review/monthly/page.tsx`（新規）

- findings をカテゴリ別カードで表示。`status: "ok"` は緑系・「守れています」トーン、
  `attention` は黄系・「確認してください」トーン（計画 10 の状態色に合わせる）。
- 各 finding に「関連ルールを開く」リンク（relatedSymbols → セッション詳細）。
- 過去の月次レビュー一覧（期間セレクタ）。
- ページ冒頭に固定文: 「このレビューは、あなたが登録した情報とルールの整合を確認するものです。
  売買の推奨ではありません。」

## テスト

置き場所: `tests/features/portfolio/`

必須ケース:

1. 入力収集: ルール無し保有銘柄が正しく列挙される / 出口条件の有無判定が正しい
2. 同一 (user, period) で 2 回実行しても 1 件しか作られない
3. LLM 出力に実在しない symbol が含まれた場合、relatedSymbols から除外される
4. パース失敗時に `holistic_reviews` へ保存されず、翌回の cron で再試行対象になる
5. コスト上限超過ユーザーがスキップされ、他ユーザーの生成は続行される
6. 他ユーザーのレビューが API から見えない（**所有権テスト**）
7. safety 不合格時に表示用文言が差し替えられる（計画 08 と同じ方式）

## 完了条件

- [ ] 月次レビューが自動生成され、通知から閲覧できる
- [ ] `status: "ok"` の「守れている」報告が含まれる
- [ ] 免責文が表示され、売買提案が含まれない
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
