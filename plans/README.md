# 実装計画（plans/）

このフォルダは、Ruletrade-AI に「銘柄別ルールの質問ウィザード」「株価・ニュースの自動監視と通知」
「LLM 利用料金の管理」「Today 画面などの UX 刷新」を追加するための実装計画集である。

各計画は **1 計画 = 1 ブランチ = 1 PR** を想定した単位に分割してある。
計画は上から順に読み、指示されたファイルパス・型名・テーブル名をそのまま使うこと。
計画に書かれていない設計判断が必要になった場合は、勝手に推測して進めず、
「未決事項」として PR 説明に書くこと。

## 計画一覧と実施順序

| # | ファイル | 内容 | 依存 |
|---|---------|------|------|
| 01 | [01-policy-and-docs.md](01-policy-and-docs.md) | 通知ポリシー改訂と ADR（価格・ニュース監視の境界定義） | なし |
| 02 | [02-price-data-foundation.md](02-price-data-foundation.md) | 株価の自動取得基盤（PriceProvider・日次バッチ・鮮度表示） | 01 |
| 03 | [03-trade-rule-monitoring-fields.md](03-trade-rule-monitoring-fields.md) | 銘柄別ルールへの監視用フィールド追加（仮説の破れ条件など） | なし |
| 04 | [04-beginner-question-wizard.md](04-beginner-question-wizard.md) | 初心者向け質問ウィザード（低負荷回答・わからないボタン） | 03 |
| 05 | [05-llm-cost-management.md](05-llm-cost-management.md) | LLM 利用料金の記録・可視化・上限管理の完成 | なし |
| 06 | [06-price-rule-alerts.md](06-price-rule-alerts.md) | 価格条件の成立通知（決定的判定・LLM 不使用） | 02, 03 |
| 07 | [07-portfolio-target-drift.md](07-portfolio-target-drift.md) | ターゲット配分とドリフト検知通知 | 02 |
| 08 | [08-news-pipeline.md](08-news-pipeline.md) | ニュース自動取得→照合→分類→要約→通知 | 03, 05 |
| 09 | [09-monthly-holistic-review.md](09-monthly-holistic-review.md) | 月次総合レビュー（リスク許容度×資産×ルール） | 05 |
| 10 | [10-ux-today-and-status.md](10-ux-today-and-status.md) | Today 画面・状態バッジ・タイポグラフィ改善 | 06（バッジの状態定義に依存） |

推奨フェーズ分け:

- **フェーズ A（基盤）**: 01 → 02 → 05
- **フェーズ B（ルール作成体験）**: 03 → 04 → 06
- **フェーズ C（自動監視）**: 07 → 08
- **フェーズ D（レビューと UX）**: 09 → 10

## 製品上の絶対原則（全計画共通）

この製品は投資助言・売買推奨をしない。すべての機能は次の一文に従う。

> ユーザーが事前に自分で決めたルールと現実のズレを検知し、**事実だけ**を通知する。判断は常にユーザーが行う。

したがって:

- 通知・画面・AI 出力の文言に「買うべき」「売るべき」「売り時」「買い時」「おすすめ」
  「チャンス」など、行動を推奨する語を使ってはならない。
  `src/lib/safety/prohibited-phrases.ts` の禁止語リストを必ず経由する。
- 通知文は必ず「事実 + ユーザー自身のルールへの参照 + 確認の促し」の 3 要素で構成する。
  - 良い例: 「A社 (7203) の終値が、あなたのルール『取得価格から -15% で見直す』の条件を満たしました。ルールを確認してください。」
  - 悪い例: 「A社が下落しています。売却を検討しましょう。」
- AI 出力はユーザー表示前に必ず `src/lib/safety/safety-check-service.ts` を通す。
  既存のルールレビューがどう通しているかを踏襲する。

## リポジトリ共通の実装規約（全計画共通）

各計画を実装する前に、リポジトリルートの `AGENTS.md` を必ず読むこと。特に以下は毎回適用する。

### API ルートの書き方

`src/app/api/portfolio/route.ts` が標準形。新しいルートはこの形をコピーする。

```ts
import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    // サービス関数には必ず userId を渡す
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
```

- 認証は `requireUser()`（`src/lib/auth/require-user.ts`）。管理者専用は `requireAdmin()`（`src/lib/auth/require-admin.ts`）。
- cron ルートは `assertValidCronRequest(request)`（`src/features/notifications/services/cron-auth-service.ts`）で保護する。
  既存例: `src/app/api/cron/notifications/check/route.ts`
- エラーは `AppError`（`src/lib/errors/app-error.ts`）を throw する。
  シグネチャ: `new AppError(code, message, httpStatus, details, isRetryable?)`

### データベースの書き方

- DB クライアントは `createDatabaseClient()`（`src/lib/db/database-client.ts`）。
  Supabase 風のクエリビルダー（`db.from("table").select().eq(...)`）で SQLite に読み書きする。
- テーブルは最初の insert 時に自動作成される（`src/lib/db/sqlite-client.ts` の `ensureTableForRow`）。
  ただし **unique 制約・インデックス・not null が必要なテーブルは、
  `src/lib/db/sqlite-schema.ts` の `schemaStatements` 配列に `create table if not exists` 文を追加**して明示定義する。
  各計画の「データモデル」節に、どちらの方式を使うか明記してある。
- **所有権チェック**: ユーザー所有データを読むクエリには必ず `.eq("user_id", params.userId)` を付ける。
  新しい API ルート・サービスには「他ユーザーの ID ではアクセスできない」ことを証明するテストを必ず追加する（`AGENTS.md` の必須要件）。

### AI 呼び出しの書き方

- AI 呼び出しは必ず `callAi`（`src/lib/ai/provider-gateway.ts`）を経由する。プロバイダ直叩き禁止。
- `taskWeight` は 3 段階: `"light"`（分類など単純作業）/ `"standard"`（下書き生成）/ `"heavy"`（総合レビュー）。
- 実行ログは `src/lib/ai/logs/with-ai-run-logging.ts` の仕組みに載せる（`ai_run_logs` テーブル）。
- コスト上限は `checkAiCostLimit` / `incrementAiCostUsage`（`src/lib/cost-limit/`）。
  計画 05 で導入する `runMeteredAiCall` ラッパーができた後は、新規の AI 呼び出しはすべてそれを使う。
- LLM 出力は必ず zod スキーマで構造化して受け、パース失敗は**エラーとして明示的に失敗させる**
  （デフォルト値で握りつぶさない。`AGENTS.md` の Fallback rules 参照）。

### フォールバック禁止の原則

- データ取得失敗・欠損時は、黙って代替値にフォールバックせず、明示的にエラーにするか
  「データがない」ことを UI に表示する。
- 例: 株価が取れない銘柄は「最新価格: 未取得（手動入力値を表示中）」と表示する。
  古い価格を最新のように見せてはならない。

### テスト

- サービスのテストは `tests/features/<ドメイン名>/` に置く（例: `tests/features/portfolio/`）。
- 各計画の「テスト」節に列挙したケースを最低限すべて書く。特に**所有権テストは省略不可**。
- `.skip` / `.only` 禁止（CI の `npm run check:test-hygiene` で落ちる）。
- 完了前に必ず実行: `npm run typecheck && npm run lint && npm run test`
- UI を変更した計画では `npm run test:e2e` も実行する。

### 環境変数

- サーバ専用のシークレットに `NEXT_PUBLIC_` を付けない。
- 新しい環境変数は `src/lib/env.ts` / `src/env.ts` の既存パターンに従って追加し、`.env.local` は編集しない
  （`.env.example` 相当のドキュメントがあればそちらを更新する）。

## LLM・コード・人間の役割分担（設計方針）

| 仕事 | 主体 | 理由 |
|---|---|---|
| 価格取得・閾値判定・ドリフト計算・銘柄名照合・品質ゲート | 決定的コード | 無料・即時・監査可能。LLM を使ってはならない |
| ニュースの関連度・仮説への影響分類 | `taskWeight: "light"` の LLM | 意味解釈が必要だが 1 件ずつは単純 |
| 仮説文の下書き・ニュース要約・月次総合レビュー | `"standard"` / `"heavy"` の LLM | 件数を絞って質を出す |
| ルール承認・通知への応答・売買行動 | 人間 | 製品哲学とコンプライアンス上、委譲禁止 |

この表に反する実装（例: 価格が閾値を超えたかを LLM に聞く）をしてはならない。
