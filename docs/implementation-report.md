# Simplified MVP 実装報告

対象ブランチ: `simplify-v2`
確認日: 2026-09-27

## 1. 削除した主要機能・基盤

TradingRule / Rule Builder と承認フロー、RAG・embedding・文書/PDF取込、ポートフォリオ・watchlist・練習モード、課金、管理コンソール、通知、マルチエージェント、OpenAI等の複数AI providerとprovider gateway、Codex連携、独自認証・ユーザー所有権基盤、独自SQLite query builder、OpenAPI定義・生成型を削除しました。旧schemaからのデータ移行は行いません。旧DBとは別の `.data/ruletrade-mvp.sqlite` を使います。

古いdocs、CI workflow、eval / smoke scripts、無関係なunit・integration・E2E testsも整理しました。package scriptsからOpenAPI、Codex smoke、旧eval runner等のコマンドを除いています。

## 2. 残したdependencies

実行時はNext.js 16.3.6、React 19.2.4、Tailwind CSS 4、Zod 4、better-sqlite3 12、lucide-reactを使います。開発・検証にはTypeScript、ESLint、Prettier、Vitest、Playwright、tsxを残しています。

## 3. 追加したdependencies

Google公式Gemini SDKの `@google/genai` 1.x と、SQLiteを直接扱うDrizzle ORM 0.45.xを追加しました。provider abstractionやrepository layerは追加していません。

## 4. DB schema

SQLite/Drizzleの4テーブルで構成します。

- `stocks`: `id`, nullable `ticker`, `name`, `normalized_name`, nullable `market`, `created_at`。
- `decisions`: `id`, `stock_id`, `type`, source of truthの`raw_input`、nullable `transcript` / `follow_up_answer` / `thesis` / `review_at`、抽出した前提・見直し条件・買い増し条件、`created_at`。
- `transactions`: `id`, `stock_id`, `side`, `quantity`, nullable `price` / `fee` / `decision_id`, `executed_at`, `created_at`。
- `reviews`: `id`, required `stock_id`, nullable `decision_id`、`current_input`, 比較`summary` / `differences`、requiredなユーザー本人の`reflection`、`created_at`。

銘柄削除時は関連記録をcascade削除し、参照decision削除時は取引・reviewのdecision linkをnullにします。取得できなかった取引価格を0で補完せず、NULLとして保存します。

## 5. 新しいdirectory structure

```text
src/app/                     ホーム、銘柄詳細、売買履歴、Gemini用Route Handlers
src/features/capture/        音声・テキスト入力
src/features/decisions/      判断の保存、timeline、mapper
src/features/reviews/        過去判断との比較・振り返り
src/features/transactions/   売買記録
src/lib/ai/gemini.ts         server-only Gemini client
src/lib/db/                  Drizzle schemaとSQLite接続
src/schemas/                 Zod schema
tests/                       unit、integration、fixture、Playwright E2E
scripts/                     小規模evalとrepo/test hygiene checks
```

## 6. 主な画面

- `/`: 音声またはテキストで記録し、抽出結果を確認・修正して保存。レビュー期限が来た判断もアプリを開いたときに表示します。
- `/stocks/[id]`: 銘柄ごとの判断timeline、売買履歴、比較フォーム、振り返りを表示します。
- `/transactions`: 全銘柄の売買履歴を時系列表示します。

Playwrightで各画面のdesktop / 375px幅を確認しました。画像は無視対象の `test-results/mvp-*.png` にあります。すべて横方向のoverflowや主要内容の切れがないことを確認しました。

## 7. AI processing flow

ブラウザ音声はMediaRecorderで録音し、`/api/decisions/transcribe`で文字起こしします。ユーザーが文字起こしを編集した後、別の`/api/decisions/extract`へ送り、Zod検証した抽出結果を確認画面に表示します。ユーザーが保存を確定した後にServer Actionが判断と任意の取引を同一DB transactionで保存します。入力に不足がある場合も追加質問は最大1問で、回答は`follow_up_answer`として原文と分けて保存します。

比較では対象stockの履歴を取得してGeminiへ送り、`/api/reviews/compare`でsummaryとdifferencesを検証します。Geminiへのsystem instructionで売買推奨を禁じ、server-only clientを使い、出力をZodで検証します。これらは実装上の制約であり、モデルの応答が売買推奨を絶対に含まないことを保証するものではありません。Reviewはユーザーの振り返り文と共に保存します。期限到来の判断からレビューを開いた場合、Reviewは期限対象の元decisionへ紐付きます。売却取引も同時に記録する場合は、別途作成したsell DecisionへTransactionを紐付けます。レビュー保存後、その元decisionは期限レビュー一覧から除外されます。

## 8. テスト結果

| Check | 結果 |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | 7 files、19 tests pass。mapper、comparison context、schema、DB/actions、Gemini routeなど |
| `npm run check:test-hygiene` | pass。`.skip` / `.only`なし |
| `npm run check:repo-hygiene` | pass。database artifactなし |
| `git diff --check` | pass |
| `npm run test:e2e` | Chromium 2 tests pass。100株・価格不明の購入、原文保持、timeline、比較、売却・Review、売買履歴、期限表示、fixture音声入力を確認 |
| Production build | `NEXT_DIST_DIR=.next-backend-webpack npx next build --webpack` pass。標準Turbopack buildは制限環境でport bind時に失敗 |
| `npm audit` | 依存更新後の前回auditは0 vulnerabilities。最終再照会はregistry DNS制限で実行できず |

PlaywrightのChromiumはUbuntu 26.04を未対応hostとして拒否したため、Playwright公式のUbuntu 24.04 fallback binaryを取得しました。E2E実行時だけ `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` を指定しています。アプリ設定やruntimeにplatform fallbackは加えていません。

検証環境はNode.js 24.15.0で、Node 20はインストールされていないためNode 20での実行は未確認です。Gemini実APIを呼ぶlive eval、実機マイク録音は未実施です。E2EではAI endpointとMediaRecorderをfixtureで置き換えています。

抽出fixture datasetは12件です。`npm run test:eval`でGemini実APIを使う小規模evalを任意実行できます。明示的な`GEMINI_API_KEY`と`GEMINI_MODEL`が必要で、CIでは実行していません。

## 9. 残ったlegacy code / 設定

- `.agents/skills/review-checklist/SKILL.md`は旧認証・ownership要件を含みます。新single-user方針への更新は自動審査で拒否されたため、再編集・削除は行わず残しました。
- 旧設計に沿った`.github/instructions/`と`.github/prompts/`のtracked資料は削除しました。`.github/copilot-instructions.md`は現在の指示を`AGENTS.md`へ委譲する短い参照に更新しました。
- `.github/workflows/deploy.yml`等のproduction deployment設定は変更していません。
- `CLAUDE.md`は`@AGENTS.md`を参照しており、新MVP方針を共有します。

`.env.local`は開かず、変更していません。tracked SQLiteファイルはなく、`.data/`はgitignore対象です。`test-results/`の画面captureもgitignore対象です。

## 10. YAGNIにより今回実装しなかったもの

ユーザー/認証/ownership、多人数利用とクラウド同期、旧DB migration、複数AI provider、RAGと文書取込、証券会社API、自動売買、損益・税・配当計算、portfolio最適化、push/email/cron通知、複雑な安全・承認スコアリング、分析dashboard、正式なデプロイ・運用基盤は追加していません。必要性が実際に生じてから検討します。
