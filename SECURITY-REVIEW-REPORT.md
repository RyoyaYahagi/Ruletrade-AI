# Ruletrade-AI セキュリティレビュー統合レポート

- **ブランチ**: `codex/sqlite-migration`
- **レビュー日**: 2026-05-26
- **レビュー手法**: Phase 1 静的チェック → Phase 2 並列サブエージェントレビュー → Phase 3 Red Team 深掘り

---

## Phase 1: 自動静的チェック

**実施内容**: `scripts/security-checks/migration-lint.js` + `pattern-check.js` + `.github/workflows/security.yml`

### 修正済み
- ✅ `admin/*` page.tsx に `export const dynamic = "force-dynamic"` を追加
- ✅ `require-admin.ts` に `app_metadata.role` の undefined/null guard を追加

### CI 自動化
- 新規スクリプト `migration-lint.js`（RLS・重複インデックス・ポリシーパターンチェック）
- 新規スクリプト `pattern-check.js`（10+ セキュリティアンチパターンチェック）
- GitHub Actions `.github/workflows/security.yml`（PR/push/週次スケジュール）

**結果**: 0 blocking / 2 warnings（SQLite 既知制約）

---

## Phase 2: 領域別並列レビュー（Auth / API / DB）

### BLOCKING 発見（Phase 2）

| # | 領域 | 内容 | 修正状態 |
|---|------|------|----------|
| 1 | Auth | SQLite モードで全ユーザーが admin（`role: "admin"` ハードコード） | ✅ 修正（`MOCK_AUTH_ROLE` env var に変更） |
| 2 | Auth | SQLite モードで RLS 完全消失（`SqliteQueryBuilder` にユーザーコンテキストなし） | ⚠️ 既知制約（P0 ガード推奨） |
| 3 | Auth | `requireAdminPermission()` が `permission` 引数を無視 | ⏳ 未修正（P1） |
| 4 | API | Mass Assignment 3 ルート（`notifications/preferences`, `legal/acceptance`, `privacy/settings`） | ✅ 修正（`body.userId` destructuring で除外） |
| 5 | API | `investment-memory/route.ts` の情報漏洩（raw error 返却） | ⏳ 未修正（P1） |
| 6 | API | `feedback/route.ts` GET の認可スコープ欠落（`userId` フィルタなし） | ✅ 修正（Route + Service 両層でフィルタ追加） |
| 7 | API | `support/tickets` POST の認証欠落（`userId = null` でゲスト投稿可能） | ⏳ 未修正（P1） |
| 8 | API | `support/tickets/[id]/comments` GET の認証欠落 | ⏳ 未修正（P1、public 閲覧として意図的かも） |
| 9 | DB | `ai_run_logs` テーブル未作成（マイグレーションファイル欠落） | ⏳ 未修正 |
| 10 | DB | SQLite スキーマが 70+ テーブル不足（`sqlite-schema.ts` に 7 テーブルのみ） | ⏳ 未修正（SQLite 開発専用前提） |
| 11 | DB | `feedback_items`/`feedback_votes` が全ユーザー読み取り可能（`using (true)`） | ⏳ 未修正（P0 ガードで間接的に緩和） |

### WARN 発見（Phase 2）
- `getCurrentUser()` の空 catch（エラーを飲み込む）
- `detectProhibitedPhrases` の正規化不完全（半角カタカナ・全角英数字未対応）
- `validateJsonRequest()` 未使用の API Routes（`investment-memory`, `me`, `analytics/events`, `privacy/delete/account`, `privacy/export`）

---

## Phase 3: Red Team 深掘り

**手法**: 攻撃者役サブエージェント（8 シナリオ考案）+ 防御者役サブエージェント（評価＋対策提案）の並列実行

### 重要な追加発見（Red Team）

**🔴 Step A 修正の不備**: `feedback/route.ts` で `{ userId: user.id }` を渡す修正を行ったが、サービス層 `listFeedback()` のシグネチャは `{ status?: string }` のままだった。TypeScript 上は不正な呼び出しだが、JS では無視されるため**全ユーザーfeedback漏洩は継続していた**。→ **即座に追加修正済み**（`feedback-service.ts` のシグネ変更 + `.eq('user_id')` 追加）

### 攻撃シナリオ一覧

| # | シナリオ | 難易度 | 再現可能性 | 緊急度 |
|---|---------|--------|------------|--------|
| 1 | **SQLite 水平権限昇格** — `user_id` フィルタ忘れで他ユーザーデータアクセス | 低 | 現在のコードで実行可能 | **CRITICAL** |
| 2 | **Admin 権限スコープ過大** — `requireAdminPermission()` が permission 引数を無視 | 低 | 現在のコードで実行可能 | **CRITICAL** |
| 3 | **フィードバック横断収集** — `using(true)` + `listFeedback` の userId 無視（修正済み） | 低 | ~~実行可能~~ **修正済み** | ~~HIGH~~ **FIXED** |
| 4 | **エラー情報漏洩** — `investment-memory` で生エラーメッセージをクライアントに返却 | 低 | 実行可能 | MEDIUM |
| 5 | **ゲストチケット悪用** — `userId = null` で匿名チケット作成（DoS/フィッシング） | 低 | 実行可能 | **HIGH** |
| 6 | **プロンプトインジェクション迂回** — `normalizeText()` が全角英数字・半角カタカナ未対応 | 低 | 実行可能 | **HIGH** |
| 7 | **MOCK_AUTH 認証バイパス** — 環境変数設定ミスで認証完全無効化 | 中 | 実行可能（設定依存） | **CRITICAL** |
| 8 | **SQLite 動的カラム汚染** — `ensureTableForRow()` が任意キーをカラムとして追加 | 中 | 実行可能 | MEDIUM |

---

## 推奨アクション（優先順位付き）

### [P0] 即座に対応 — 本番環境を守る

| # | 対策 | 対象リスク | 工数 | 効果 |
|---|------|-----------|------|------|
| 1 | **`MOCK_AUTH_EMAIL` の本番ガード** — `NODE_ENV === "production"` で設定を拒否 | R7 | 小（30分） | 全認証バイパス防止 |
| 2 | **SQLite モードの本番禁止** — `DB_PROVIDER=sqlite` を production で禁止 | R1/R8 | 小（15分） | RLS 消失＋スキーマドリフト防止 |
| 3 | **`feedback-service.ts` の `listFeedback()` userId フィルタ追加** | R3 | **済** | 全ユーザー feedback 漏洩防止 |

### [P1] 次のスプリント

| # | 対策 | 対象リスク | 工数 |
|---|------|-----------|------|
| 4 | `investment-memory/route.ts` を `toErrorResponse()` に統一 | R4 | 小 |
| 5 | `me/route.ts` のエラーハンドリングを `toErrorResponse()` に統一 | R4 | 小 |
| 6 | `requireAdminPermission()` に permission チェック実装（RBAC マップ） | R2 | 中 |
| 7 | `support/tickets` POST に認証＋レート制限を追加 | R5 | 小 |

### [P2] 監視対象・長期的改善

| # | 対策 | 対象リスク | 工数 |
|---|------|-----------|------|
| 8 | 全 API Route の user_id フィルタ自動テスト | R1 | 中 |
| 9 | SQLite strict mode の実装（動的カラム警告） | R8 | 中 |
| 10 | `legal_notices` / `billing_plans` の機密情報レビュー | R3 | 小 |
| 11 | Security headers の `next.config.ts` への追加 | 全般 | 小 |
| 12 | `detectProhibitedPhrases` の正規化強化（NFKC + 半角カタカナ） | R6 | 中 |

---

## 修正コミット一覧

| コミット | 内容 |
|----------|------|
| `security(ci): add automated security checks and fix findings` | CI スクリプト作成 + admin pages force-dynamic + requireAdmin guard |
| `security: fix critical vulnerabilities from Phase 2 review` | SQLite admin ハードコード削除 + Mass Assignment 3 ルート修正 + feedback userId フィルタ（Route 層） |
| `security: fix feedback-service listFeedback userId filter` | Service 層のシグネチャ修正 + `.eq('user_id')` 追加（Red Team 発見） |

---

## 総評

**自動化されたセキュリティチェック（Phase 1）** は構造的欠陥を効率的に検出し、**並列サブエージェントレビュー（Phase 2）** は領域特化の専門知見を収集し、**Red Team 深掘り（Phase 3）** は「修正が実際に機能しているか」を検証する攻撃者視点の検証を提供しました。

特に Phase 3 の攻撃者役サブエージェントは、**開発者が行った修正が Service 層まで到達していない**という人的ミスを発見しました。これは、単なる静的チェックやレビューでは検出困難な「修正の不備」を、攻撃者視点の検証で発見した好例です。

**Red Team 手法の有効性**: 修正後のコードベースに対して攻撃者と防御者の双方向検証を行うことで、表面的な修正ではなく「実際に攻撃が防げるか」を確認できます。
