# Ruletrade-AI

**AIと一緒に「自分の投資ルール」を設計・レビュー・記録するアプリ**

> 投資助言アプリではありません。何を買う／売るかは提案しません。
> ユーザー自身が決めたルールを、AIが「抜け漏れ・矛盾・危うい前提」の観点から壁打ちし、構造化して残すための意思決定支援ツールです。

このリポジトリは、**AIエンジニアを志望する学生のポートフォリオ**として開発しています。
単に「LLMを呼ぶアプリ」ではなく、**LLMを本番プロダクトに組み込むときに必要になる周辺設計（安全性・検証・観測・コスト管理・評価・RAG・マルチエージェント）** を一通り実装することを目的にしています。

> **ブランチについて**: `main` はMVP（ルール作成体験のコア）。RAG・通知・課金・管理画面・実践モードなどの発展機能は `develop` で実装済みです。本READMEはプロダクト全体像を示すため develop の機能も含めて記述しています。`main` に存在するコード／ドキュメントにのみファイルリンクを張っています。

---

## 1. このアプリは何をするのか

個人投資家の多くは、感情・ニュース・なんとなくの勘で売買を決めてしまいます。
結果が悪くても「なぜそうしたか」を思い出せず、良くても実力か運か分からない。プロセスが言語化されていないと、同じ失敗を繰り返します。

Ruletrade-AI は、投資する**前**にルールを言語化させ、それをAIと一緒に磨くことでこの問題に取り組みます。

| 局面 | AIの伴走 |
|---|---|
| **買う前** | AIが質問しながら投資ルール（仮説・価格帯・損切り・利確・買い増し・最大比率・決算方針）を完成まで支援 |
| **保有中** | ルールとのズレ、損切り接近、買い増し条件、ポートフォリオの集中度をレビュー |
| **売却後** | ルールを守れたか、勝ち負けの理由、改善点を振り返り、失敗パターンとして記録 |
| **長期的** | 過去の失敗パターンや投資スタイルをRAGで参照し、ユーザーに合わせたルール設計を支援 |

**設計の中心原則：「構造化ルールが信頼できる唯一の真実（source of truth）。AIの出力は下書き／レビュー成果物であり、実行可能な真実ではない」**
ルールはAIの応答から直接アクティブにならず、`draft → review → approved` の明示的なステートを通ります。生成・レビュー・評価・承認は別々の責務として分離し、**承認するのは常にユーザー**です。

詳細は [docs/product-principles.md](docs/product-principles.md) / [docs/architecture.md](docs/architecture.md) を参照。

---

## 2. AIエンジニアリングとして学びたいこと

「LLM API を呼ぶ」だけなら誰でもできます。このプロジェクトでは、**本番品質でLLMを扱うために必要な周辺の難しさ** を意図的に題材にしています。

### (1) AI Provider Gateway — プロバイダ抽象化と切り替え
- Mock / OpenAI / Gemini を**同じインターフェース**で扱い、環境変数で切り替え（[src/lib/ai/provider-gateway.ts](src/lib/ai/provider-gateway.ts)）
- ローカル開発は `AI_PROVIDER=mock` で APIキーなし・無料・決定的に動かせる
- タスクの重さ（`light / standard / heavy`）でモデルを出し分け、プロバイダの健全性を見て最良を選ぶ**重み付き選択**
- 機能／エージェント別のモデルルーティング（Model Routing）
- **学び：** ベンダーロックインを避け、テスト可能なAI層をどう設計するか

### (2) Safety Check — 金融助言リスクの検出ゲート
- AI出力を**表示する前に**必ず検査し、「買い推奨・売り推奨・価格予測・利益保証・煽り・秘密情報の要求」を `block / warn / allow` で判定（[src/lib/safety/](src/lib/safety/)）
- ブロック時は安全なフォールバックメッセージへ差し替え、ログを残す
- **学び：** LLM出力をそのままユーザーに見せない「ガードレール」の作り方。プロンプトだけに頼らず、コードとテストで安全境界を表現する

### (3) Structured Output + 検証 — Zodスキーマによる契約
- AIの出力は自由テキストではなく **Zodスキーマで検証**（[src/schemas/](src/schemas/)）
- 構造化された投資ルールスキーマ（`TradeRule`）を真実とし、自然言語の説明はそこから生成
- スキーマ検証に失敗した出力は破棄。「壊れたJSONがUIに届かない」ことを型で保証
- **学び：** 非決定的なLLM出力を、決定的なアプリの世界に安全に橋渡しする方法

### (4) Evals — AIレビュー品質の定量評価
- Precision / Recall / F1 / Schema Valid Rate / Safety Pass Rate / Latency / 推定コストを計測（[src/lib/evals/](src/lib/evals/)、[docs/evals.md](docs/evals.md)）
- `missing_stop_loss_should_fail` などのテストケースで、プロンプト変更の良し悪しを**バージョン間で比較**
- 将来は LLM-as-a-Judge / Human evaluation / CIでのeval自動実行へ拡張
- **学び：** 「なんとなく良くなった気がする」を排し、AI機能をテスト駆動で改善するループの作り方

### (5) RAG — 「過去の自分」を参照する仕組み（develop）
- 外部ニュースや株価予測ではなく、まず**ユーザー自身の過去ルール・レビュー・反省メモ・失敗パターン**をEmbedding検索
- 「過去3回のレビューでも損切り条件が曖昧と指摘されています」のように、繰り返す失敗をAIが気づける
- Document RAG（IR・決算PDFアップロード→要約→投資仮説との照合）も実装
- **学び：** Embedding・チャンク分割・ベクトル検索・パーソナライズされた文脈構築

### (6) マルチエージェント設計（develop）
- 1つの巨大AIにせず、責務を分割：Intake / Rule Builder / Rule Reviewer / Question Generator / Portfolio Review / Memory / Safety / Eval Agent
- オーケストレーション・承認状態・監査証跡（Approval States & Audit Trail）でHuman-in-the-loopを設計
- **学び：** Agentの責務分割、ループの終了条件、人間が握るべき承認境界

### (7) Observability & コスト管理
- AI実行ログ（トークン数・レイテンシ・推定コスト・プロンプトバージョン）を記録（[src/lib/ai/logs/](src/lib/ai/logs/)）
- レートリミット・コスト上限・タイムアウトで暴走と高額請求を防ぐ（[src/lib/rate-limit/](src/lib/rate-limit/) / [src/lib/cost-limit/](src/lib/cost-limit/)）
- **学び：** LLMアプリの運用コストと信頼性をどう測り、どう守るか

### (8) セキュリティ境界
- APIキー（OpenAI / Anthropic / Gemini / Stripe / Supabase Service Role）を**ブラウザに絶対露出しない**設計
- `import "server-only"` で秘密に触れるモジュールをサーバー専用に固定
- Supabase Row Level Security でユーザーデータを行レベルで分離（[docs/security.md](docs/security.md)）
- **学び：** AIアプリ特有の「APIキー漏洩」「権限越境」をアーキテクチャで防ぐ

これらの学習テーマの全体像は設計Issue [#15 このアプリ開発で学べること] にまとめています。

---

## 3. 実装済み機能

### MVP（main / develop）
- ユーザー登録・ログイン（Supabase Auth）
- 投資家プロフィール作成
- 銘柄入力からのルール作成セッション、AIヒアリング（選択肢付き質問）
- 投資ルール草案生成・バージョン管理
- AIレビュー、ルール完成度スコア、再質問ループ、Quality Gate
- AI Provider Gateway（Mock / OpenAI / Gemini）、Structured Output、Safety Check、AI実行ログ、基本評価ケース
- エラーハンドリング・レートリミット・コスト上限

### 発展機能（develop）
- **Portfolio**: 保有銘柄入力・業種/テーマ集中度チェック・ルール紐付け
- **Watchlist**: 監視銘柄・買いたい価格帯・ルール未作成検出
- **Notifications**: 見直し通知・損切り条件未設定通知などの安全なリマインダー
- **RAG / Memory**: 過去ルール・レビュー・反省メモ・失敗パターン検索（Investment Memory）
- **Document RAG**: PDF（IR・決算）アップロードとAIレビュー連携
- **Structured Trading Rules**: 構造化ルールスキーマと永続化・状態遷移・バックテスト評価・リスクレビュー
- **AI Agents**: オーケストレーション・承認/監査証跡・ルール生成ワークベンチ
- **Education**: 仮想取引で学ぶ Practice Mode、投資用語のインライン解説（Glossary）
- **運用基盤**: Feature Flags / Analytics / Observability / Admin Console / Support / Email / Billing(Stripe) / Legal・Privacy・データ削除 / i18n / 監査ログ / Closed Beta・招待

### 最終像（ロードマップ Phase 3〜5）
ポートフォリオ高度診断、株価/決算/ニュースAPI連携、CSV入出力、PWA・Push、有料プラン、そして
**AIエンジニアリング研究用途**（Agent設計比較・Prompt改善実験・RAG精度評価・Embedding/Reranker比較・LLM-as-a-Judge・Human eval UI・CIでのeval自動実行）。

ロードマップ：`v0.1 Foundation → v0.2 Rule Creation → v0.3 AI Review/Safety → v0.4 Memory/RAG → v0.5 Product Expansion → v1.0 Closed Beta`

---

## 4. 技術スタック

| 領域 | 採用技術 |
|---|---|
| フレームワーク | Next.js 16（App Router）/ React 19 / TypeScript |
| 認証・DB | Supabase Auth / Postgres / Row Level Security / Storage |
| AI | OpenAI / Gemini / Mock を Provider Gateway 経由で抽象化、Embedding検索 |
| 検証 | Zod（API入力・AI出力スキーマ） |
| UI | Tailwind CSS / shadcn 系プリミティブ |
| テスト | Vitest（単体）/ Playwright（E2E）/ SQLによるRLS検証 / Eval |
| 課金 | Stripe |
| API契約 | OpenAPI / 型安全クライアント |
| CI | GitHub Actions（typecheck / lint / test / e2e） |

---

## 5. アーキテクチャの要点

秘密情報はすべてサーバー側を経由します。ブラウザから直接プロバイダを叩くことはありません。

```text
Browser（Client Component）
  ↓ 内部APIのみ呼ぶ
Next.js API Route / Server Action
  ↓
AI Provider Gateway ── Safety Check ── Zod検証 ── 実行ログ／コスト計測
  ↓
OpenAI / Gemini / Mock  ・  Supabase（RLS） ・ Stripe
```

ディレクトリの責務分離：

```text
src/
  app/         App Router（薄く保ち、ロジックは feature/lib へ委譲）
  features/    機能単位（rules / portfolio / watchlist / rag / ai ...）のUI・サービス・フック
  lib/         共有基盤（ai / safety / evals / rag / auth / db / rate-limit / cost-limit ...）
  schemas/     Zod スキーマ（ドメイン・API・AI出力）
docs/          設計・ADR・運用ドキュメント
supabase/      マイグレーション・RLSポリシー・seed
tests/         unit / schemas / services / safety / evals / e2e
```

---

## 6. 開発の進め方（Issue駆動 × AIエージェント）

このプロジェクト自体が **AIコーディングエージェントとの協働** の実験でもあります。

- 「Design Reference」Issue群（[#13 最終機能一覧]・[#15 学べること]・[#17 Prompt設計]・[#9 RAG設計]・[#10 Eval設計] など）で設計を先に言語化し、そこから実装Issueへ分解
- 機能は小さくスコープを切って実装（v0.1 → v1.0 のマイルストーン）
- `AGENTS.md` にエージェント向けの規約（秘密を露出しない・RLSを外さない・テストを無効化しないなど）を明文化
- すべてのエージェントPRは人間のレビューとCIチェックを必須にする
- **学び：** AIに任せる範囲と、人間が握るべき安全境界・レビュー責任の線引き

---

## 7. セットアップ

### 必要環境
- Node.js 20.9+
- Docker（Supabaseローカル用）
- npm

### 起動

```bash
npm install
cp .env.example .env.local   # 既定で AI_PROVIDER=mock（APIキー不要）
npm run dev
```

`http://localhost:3000` を開き、Ruletrade-AI が表示されることを確認します。

Supabaseローカル（Docker Desktop が必要）：

```bash
npm run db:start
npm run db:status
npm run db:stop
```

### 品質チェック

```bash
npm run typecheck   # 型チェック
npm run lint        # Lint
npm run test        # 単体テスト（Vitest）
npm run test:e2e    # E2E（Playwright）
npm run test:eval   # AIレビュー品質の評価
```

### 環境変数の方針
- ブラウザに見せてよい値だけ `NEXT_PUBLIC_` を付ける（Supabase URL / anon key のみ）
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `STRIPE_SECRET_KEY` などは**サーバー専用**。`NEXT_PUBLIC_` 版は決して作らない
- `.env.local` はコミットしない

---

## 8. 安全性に関する明記

Ruletrade-AI は投資助言を提供しません。

- AI出力は「ルール設計上の不足要素の特定・前提の明確化・追加質問の生成」にのみ使います
- 表示前に Safety Check を通し、買い／売り推奨・断定的な価格予測・利益保証に見える出力はブロックします
- 最終的な判断・承認・却下はすべてユーザーが行います

詳細は [docs/safety.md](docs/safety.md) を参照。

---

## 9. ポートフォリオとしての見どころ（まとめ）

このリポジトリで見てほしいのは「動くアプリ」だけでなく、**LLMをプロダクトに載せるときの設計判断**です。

1. **Provider Gateway** でAI層をテスト可能・差し替え可能に抽象化した
2. **Safety Check + Zod検証** で、非決定的なLLM出力に対するガードレールをコードとテストで実装した
3. **Evals** でAI品質を定量化し、プロンプト改善をテスト駆動にした
4. **RAG / マルチエージェント** で「過去の自分を参照する」パーソナライズと責務分割を設計した
5. **Observability / コスト上限 / レートリミット** で本番運用の信頼性とコストを設計した
6. **秘密の非露出 / RLS / server-only** でAIアプリ特有のセキュリティ境界を引いた
7. **Issue駆動 × AIエージェント協働** という開発プロセス自体を設計した

「LLMを呼べる」から一歩進んで、「LLMを安全・検証可能・運用可能な形でプロダクトに統合できる」ことを示すことが、このプロジェクトの目的です。
