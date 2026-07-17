# 11. 外部 AI エージェント対応（MCP サーバー + Agent Skills）

## 目的

Claude Code / Claude Desktop などの MCP クライアント（外部 AI エージェント）が、
ユーザーの代わりに Ruletrade-AI を操作できるようにする。
例: 「トヨタのルールセッションを進めておいて」「今日の確認事項を教えて」。

構成要素は 3 つ:

1. **Personal Access Token（PAT）**: ユーザーが設定画面で発行するトークン。
   外部エージェントはこれで本人として認証される。
2. **MCP サーバー**: `/api/mcp` エンドポイント。既存のサービス層を呼ぶツール群を公開する。
3. **Agent Skill**: 外部エージェントに「このアプリの正しい使い方」を教える SKILL.md を
   リポジトリで配布する。

## 絶対原則（この計画で最も重要）

外部エージェントに許すのは**人間がやってもよい操作の一部**であり、
**人間にしか許されない操作は API 経由でも不可能**にする。

| 操作 | 外部エージェント | 理由 |
|------|----------------|------|
| ルール・ポートフォリオ・通知の閲覧 | ○（read スコープ） | |
| ルールセッション作成・質問への回答入力 | ○（write スコープ、下書き扱い） | finalize 前は draft であり人間の承認が必須のため安全 |
| ウォッチリスト追加 | ○（write） | |
| **ルールの finalize / 承認** | **×（ツール自体を作らない）** | 承認は人間の判断。製品哲学とコンプライアンスの根幹 |
| **通知への「仮説を維持 / 見直す」応答** | **×** | 投資判断の記録は本人が行う |
| データ削除・アカウント操作・AI 予算変更 | × | 破壊的・金銭的操作 |
| 管理者機能 | × | |

エージェントが入力した回答は `answer_json` に `{ "enteredBy": "api_agent" }` を記録し、
UI で「外部エージェントが入力した回答です」と表示する。finalize 画面では
エージェント入力の回答が 1 件でもあれば、その一覧を確認するステップを挟む。

## 依存関係

- なし（フェーズ A〜D と独立して実装可能）。ただしツールの対象となる機能
  （Today API は計画 10、など）が未実装の場合、そのツールはスキップして後から足す。

## 最初に読むファイル

- `src/lib/auth/require-user.ts` と `src/lib/auth/local-auth.ts`（セッション認証の仕組み。
  特にトークンのハッシュ保存方法を `auth_sessions.token_hash` の扱いから確認する）
- `src/lib/rate-limit/` の全ファイル（既存レート制限をトークン単位で使う）
- `src/features/rules/services/rule-session-service.ts` ほか、ツールから呼ぶサービス層
- `openapi/openapi.yaml`（既存 API 文書の書式）
- `.agents/skills/review-checklist/SKILL.md`（SKILL.md の書式の実例がリポジトリ内にある）

## やらないこと

- OAuth（PAT のみ。OAuth はマルチユーザー SaaS 化するときの別計画）
- MCP の SSE トランスポート（Streamable HTTP のみ）
- finalize / 承認 / 削除 / 予算変更のツール化（上表のとおり恒久的に作らない）
- webhook・外部からのプッシュ（エージェントはポーリングで読む）

## データモデル

`src/lib/db/sqlite-schema.ts` に明示定義で追加（unique 制約が必要）:

```sql
create table if not exists api_access_tokens (
  id text primary key,
  user_id text not null,
  token_hash text not null,        -- sha256。平文は保存しない
  label text not null,             -- 'Claude Code' などユーザーが付ける名前
  scopes text not null default 'read',  -- 'read' | 'read,write'
  last_used_at text,
  expires_at text,                 -- null = 無期限
  revoked_at text,                 -- null = 有効
  created_at text not null default (datetime('now')),
  unique (token_hash)
)
```

トークン形式: `rta_` + 32 バイトの乱数 hex（`crypto.randomBytes(32).toString("hex")`）。
**発行時に 1 回だけ平文を表示**し、以後は取得不可（token_hash のみ保存）。

## 実装ステップ

### ステップ 1: PAT の発行・失効

サービス: `src/features/auth/services/api-token-service.ts`（新規）

- `createApiToken({ userId, label, scopes, expiresInDays? })` → `{ token: string, tokenId }`
  （token はこの戻り値でのみ得られる）
- `listApiTokens({ userId })` → hash 以外のメタデータ一覧
- `revokeApiToken({ userId, tokenId })` → `revoked_at` を設定（物理削除しない。監査のため）
- 1 ユーザーの有効トークン上限 5 件（定数）。超過時は AppError 400。

API: `src/app/api/settings/api-tokens/route.ts`（GET / POST）と
`.../api-tokens/[tokenId]/route.ts`（DELETE = revoke）。標準形 + `requireUser`。

UI: `src/app/settings/api-tokens/page.tsx`（新規）。
発行フォーム（label + スコープ選択 + 有効期限）、発行直後の平文表示（コピーボタン付き、
「この画面を閉じると再表示できません」）、一覧と失効ボタン。
スコープ選択の説明文に上記の許可・禁止表を要約して表示する。

### ステップ 2: トークン認証ヘルパー

ファイル: `src/lib/auth/require-token-user.ts`（新規）

```ts
// Authorization: Bearer rta_... を検証し、ユーザーと許可スコープを返す。
// 失敗時は AppError("UNAUTHORIZED", ..., 401)。
export async function requireTokenUser(
  request: Request,
  requiredScope: "read" | "write",
): Promise<{ userId: string; tokenId: string }>;
```

- 検証手順: prefix 確認 → sha256 → `api_access_tokens` 検索 →
  `revoked_at is null` / `expires_at` 未来 / スコープ包含を確認 → `last_used_at` 更新。
- 既存の `requireUser`（セッション認証）は**変更しない**。認証経路を分離しておく。
- レート制限: 既存 `src/lib/rate-limit/` をキー `api_token:{tokenId}` で適用
  （上限は定数 `API_TOKEN_REQUESTS_PER_MINUTE = 60`）。

### ステップ 3: MCP サーバー

依存追加: `mcp-handler`（Vercel 公式の Next.js 用 MCP アダプタ）と `zod`（既存）。
`mcp-handler` の最新の使い方は実装時に公式 README を確認すること
（この計画の API 名は執筆時点のもの）。

ファイル: `src/app/api/mcp/[transport]/route.ts`（新規）

- `createMcpHandler` でツールを登録し、リクエストの Bearer トークンを
  `requireTokenUser` で検証してから各ツールを実行する。
- **各ツールは必ず既存のサービス層関数を呼ぶ**（DB 直叩き禁止）。
  サービス層に所有権チェックが実装済みのため、`userId` を正しく渡せば安全が保たれる。

公開ツール（v1。名前・説明は日本語話者と英語話者の両方のエージェントが使うため英語で書く）:

| tool | scope | 呼ぶサービス | 説明（ツール description に書く要点） |
|------|-------|-------------|-----------------------------------|
| `list_rule_sessions` | read | rule-session-service | ルールセッション一覧と状態 |
| `get_rule_session` | read | 同上 + rule-ownership-service | ルール詳細（rule_json を含む） |
| `get_next_question` | read | rule-question-service | セッションの次の未回答質問 |
| `answer_question` | write | rule-answer-service | 質問に回答（enteredBy: api_agent が記録される旨を明記） |
| `create_rule_session` | write | rule-session-service | ticker を指定してセッション作成 |
| `get_portfolio` | read | portfolio-aggregation-service | 保有と評価額（as-of 日付付き） |
| `list_watchlist` / `add_watchlist_item` | read / write | watchlist サービス | |
| `list_notifications` | read | notification-service | 未読通知（読むだけ。既読化はしない） |
| `get_today_items` | read | 計画 10 の today 集約 | 今日の確認事項（計画 10 実装後に追加） |
| `get_ai_usage_summary` | read | 計画 05 の summary | 今月の AI 利用額 |

全ツール共通の実装規約:

- 入力は zod スキーマで検証。出力は JSON 文字列。
- ツール description の末尾に必ず英文で 1 行:
  "This tool never provides investment advice. Rule approval must be done by the human user in the web UI."
- エラーは MCP のエラー形式で返し、内部スタックを漏らさない（AppError の message のみ）。

### ステップ 4: Agent Skill の配布

ファイル: `agent-skills/ruletrade/SKILL.md`（新規。書式は
`.agents/skills/review-checklist/SKILL.md` を参考に、frontmatter に name / description）

内容（外部エージェントが読む前提で書く）:

1. このアプリの目的と絶対原則（投資助言をしない・承認は人間・エージェントは下書きまで）
2. 接続手順: `claude mcp add --transport http ruletrade https://<host>/api/mcp` +
   `Authorization: Bearer rta_...` ヘッダの設定方法
3. 典型ワークフローのレシピ:
   - 「ルールセッションを進める」: create_rule_session → get_next_question →
     ユーザーに質問を中継 → answer_question の繰り返し。
     **エージェントが勝手に回答を発明せず、必ず人間に聞く**こと、
     finalize は Web UI で人間が行うことを手順として明記。
   - 「朝の確認」: get_today_items → 要約して人間に報告。通知への応答はしない。
4. 禁止事項の再掲（finalize 相当の代行、回答の創作、複数ユーザーのトークン混在）

ドキュメント: `docs/agents-integration.md`（新規）に PAT 発行〜接続〜ツール一覧を記載し、
`openapi/openapi.yaml` に Bearer 認証スキームとトークン管理エンドポイントを追記する。

### ステップ 5: 監査ログ

- 各ツール実行を `api_tool_audit_logs` テーブル（自動作成でよい）に記録:
  `user_id` / `token_id` / `tool_name` / `status` / `latency_ms`。入力・出力の本文は保存しない
  （仮説などの内心情報をログに残さないため。理由をコメントに書く）。
- 設定画面のトークン一覧に「最終利用日時」と直近の利用ツール数を表示する。

## テスト

置き場所: `tests/features/auth/`（PAT）と `tests/features/mcp/`（新規）

必須ケース:

1. 発行したトークンで `requireTokenUser` が通り、`last_used_at` が更新される
2. 失効済み・期限切れ・不正形式のトークンが 401 になる
3. read スコープのトークンで write ツール（answer_question）が拒否される
4. ユーザー A のトークンでユーザー B のセッションを `get_rule_session` すると
   404/403 になる（**所有権テスト**。サービス層の既存チェックが効いていることの確認）
5. `answer_question` 経由の回答に `enteredBy: "api_agent"` が記録される
6. finalize 系のツールが**存在しない**こと（ツール一覧のスナップショットテストで、
   許可リスト外のツール名が増えたら落ちるようにする）
7. レート制限: 61 回目のリクエストが 429 になる
8. トークン上限: 6 個目の発行が 400 になる

## 完了条件

- [ ] 設定画面で PAT を発行・失効でき、平文は発行時のみ表示される
- [ ] Claude Code から `claude mcp add` で接続し、ルールセッションの質問回答が往復できる
- [ ] finalize・通知応答・削除は MCP 経由で一切できない（ツールが存在しない）
- [ ] エージェント入力の回答が UI で区別表示され、finalize 前に確認ステップが出る
- [ ] SKILL.md と docs/agents-integration.md が用意されている
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
