# 08. ニュース自動取得→照合→分類→要約→通知

> **状態: 実装済み**（ブランチ `codex/phase-c-auto-monitoring`）。
> 出典リンクの該当箇所ハイライト対応は追加計画 [13-news-evidence-highlight.md](13-news-evidence-highlight.md) を参照。

## 目的

保有・ウォッチ銘柄に関するニュースを自動取得し、ユーザーの投資仮説（`investmentThesis`）と
破れ条件（`thesisBreakers`、計画 03）に照らして「仮説に関係するか」を判定し、
関係する分だけ要約して通知する。ユーザーは通知を確認するだけで済む。

コスト設計（最重要）:

```
取得 100 件/日
 → 銘柄名照合（コード・無料）で 90% 落とす → 10 件
 → 軽量 LLM 分類（$0.002/件）→ 仮説に関係するのは 2〜3 件
 → 高性能 LLM 要約（$0.02/件）は関係分のみ
 → 1 日の想定コスト: ユーザーあたり $0.1 未満
```

段階ごとに件数上限（定数）を設け、暴走を構造的に防ぐ。

## 依存関係

- 計画 03（thesisBreakers）と計画 05（`runMeteredAiCall`）が先。
- 計画 01 の ADR（ニュース通知の境界）に従う。

## 最初に読むファイル

- `src/lib/prices/price-provider-factory.ts`（計画 02 のプロバイダパターンを踏襲）
- `src/lib/ai/provider-gateway.ts`（`callAi` の構造化出力の使い方）
- `src/lib/cost-limit/run-metered-ai-call.ts`（計画 05 の成果物）
- `src/lib/safety/safety-check-service.ts`（表示前チェック）
- 計画 06 の `price-alert-detection-service.ts`（検知→通知パターン）

## やらないこと

- ニュースの独自評価（「好材料です」「悪材料です」を仮説と無関係に言わない）
- 全文転載（保存するのはタイトル・要旨・URL・出典名のみ。著作権対応）
- リアルタイム速報（1 日 1〜2 回のバッチで十分。速報性を競う製品ではない）
- ソーシャルメディア・掲示板の取得

## データモデル

`src/lib/db/sqlite-schema.ts` に明示定義で追加:

```sql
create table if not exists news_items (
  id text primary key,
  source text not null,            -- 'tdnet_rss' | 'mock' など
  external_id text not null,       -- 記事URL または 配信元ID
  title text not null,
  summary text,                    -- 配信元の要旨（自作要約ではない）
  url text not null,
  published_at text not null,
  content_hash text not null,      -- title+url の sha256。重複排除用
  created_at text not null default (datetime('now')),
  unique (content_hash)
)
```

```sql
create table if not exists news_ticker_matches (
  id text primary key,
  news_item_id text not null,
  symbol text not null,
  market text not null default 'JP',
  match_method text not null,      -- 'ticker_code' | 'company_name'
  created_at text not null default (datetime('now')),
  unique (news_item_id, symbol, market)
)
```

```sql
create table if not exists news_assessments (
  id text primary key,
  user_id text not null,
  news_item_id text not null,
  session_id text not null,          -- どのルール(仮説)に対する判定か
  relevance text not null,           -- 'affects_thesis' | 'not_relevant'
  thesis_relation text,              -- 'supports' | 'challenges' | 'unclear'（affects時のみ）
  matched_breaker_index integer,     -- どの thesisBreaker に触れたか（該当時のみ）
  summary_text text,                 -- 要約（affects時のみ生成）
  model text,
  estimated_cost_usd real,
  notification_id text,
  created_at text not null default (datetime('now')),
  unique (user_id, news_item_id, session_id)
)
```

`news_items` / `news_ticker_matches` は共有データ（user_id なし）。
`news_assessments` はユーザー所有データ（仮説というユーザーの内心情報を含む）——
**全クエリに所有権チェック必須**。

## 実装ステップ

### ステップ 1: NewsProvider インターフェース

ファイル: `src/lib/news/news-provider.ts`（新規）

```ts
export type NewsArticle = {
  externalId: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string;   // ISO 8601
  sourceName: string;
};

export interface NewsProvider {
  readonly name: string;
  fetchRecentNews(params: { sinceHours: number }): Promise<NewsArticle[]>;
}
```

実装 2 つ + ファクトリ（環境変数 `NEWS_PROVIDER`、デフォルト `mock`）:

- `src/lib/news/providers/mock-news-provider.ts`: 決定的なダミー記事を返す。
  テスト用に「タイトルに銘柄コードを含む記事」「含まない記事」の両方を返すこと。
- `src/lib/news/providers/rss-news-provider.ts`: 汎用 RSS 取得。
  取得先 URL のリストは環境変数 `NEWS_RSS_FEEDS`（カンマ区切り）から読む。
  第一候補は TDnet 系の適時開示 RSS（決算・業績修正など仮説に効く一次情報の密度が最も高い）。
  RSS の XML パースは軽量に自前実装（`<item>` の title/link/pubDate/description のみ抽出）。
  パースできない item はスキップし、スキップ数をログに残す。

### ステップ 2: 取得と照合の cron

ファイル: `src/app/api/cron/news/fetch/route.ts`（新規）

1. `assertValidCronRequest`。
2. `fetchRecentNews({ sinceHours: 26 })` → `content_hash`（sha256(title + url)）で
   `news_items` に upsert（unique 衝突 = 既知記事なのでスキップ）。
3. **銘柄照合（決定的・無料）**: 全ユーザーの保有 + ウォッチ銘柄の
   (symbol, company_name) 一覧を取り、各記事のタイトル + 要旨に対して:
   - 銘柄コード（例: `7203`）が単語として含まれる → match_method: `ticker_code`
   - 会社名（`company_name` 列。正式名の部分一致で「株式会社」を除いた形も試す）→ `company_name`
   - 一致したら `news_ticker_matches` に insert。
4. 1 回の実行で処理する記事数の上限 `MAX_NEWS_ITEMS_PER_RUN = 200`（定数）。
5. レスポンス: `apiSuccess({ fetchedCount, newCount, matchedCount })`。

`vercel.json` に cron 追加（1 日 2 回: JST 8 時と 16 時）。

### ステップ 3: 分類と要約の cron

ファイル: `src/app/api/cron/news/assess/route.ts`（新規、fetch と分けるのは
LLM 障害時に取得だけは継続させるため）

各ユーザーについて:

1. 対象抽出（決定的）: そのユーザーの承認済みルールセッション（ticker 付き）×
   `news_ticker_matches` を突き合わせ、`news_assessments` に未判定の
   (news_item, session) ペアを列挙する。
2. **上限適用**: 1 ユーザー 1 日あたりの分類件数上限
   `MAX_CLASSIFY_PER_USER_PER_DAY = 20`、要約上限 `MAX_SUMMARIZE_PER_USER_PER_DAY = 5`（定数）。
   超過分は判定せず翌日に回す（`published_at` の新しい順に処理）。
3. **分類（軽量 LLM）**: `runMeteredAiCall({ feature: "news_classify", ... })` +
   `callAi({ taskWeight: "light" })`。プロンプトには記事タイトル・要旨と、
   そのセッションの `investmentThesis`・`thesisBreakers`（description と newsKeywords）を入れる。
   出力スキーマ:

```ts
z.object({
  relevance: z.enum(["affects_thesis", "not_relevant"]),
  thesisRelation: z.enum(["supports", "challenges", "unclear"]).optional(),
  matchedBreakerIndex: z.number().int().min(0).max(9).nullable(),
  reason: z.string().max(200),
})
```

   パース失敗はその記事を `relevance: 判定不能` として**保存せず**、エラーカウントに載せる
   （不正な出力を DB に残さない）。
4. **要約（標準 LLM）**: `relevance === "affects_thesis"` の分のみ
   `runMeteredAiCall({ feature: "news_summarize" })` + `callAi({ taskWeight: "standard" })`。
   出力: 3 行以内の要約 + 「あなたの仮説/破れ条件のどこに関係するか」1 文。
   プロンプト制約: 売買への言及禁止・記事にない事実の追加禁止・仮説の当否の断定禁止
   （「関係する可能性があります」まで）。
5. **Safety / Compliance Gate**: 要約文を `safety-check-service` に通し、
   不合格なら要約なしで「関係する可能性のあるニュースがあります（要約は表示できません）」に差し替える。
6. `news_assessments` に保存し、通知を作成する。

### ステップ 4: 通知

- notification_type: `news_thesis_impact`（計画 01 の予約どおり）
- 本文テンプレート（3 要素規約）:
  「{company} ({ticker}) に関するニュース: {title}。あなたの{仮説|破れ条件『{breaker}』}に関係する可能性があります。内容を確認してください。」
- 通知のアクション: 「ニュースを確認」（詳細カードを開く）/ 「仮説を維持」/ 「ルールを見直す」
  （計画 06 の 3 アクション UI を流用）。
- 詳細カード表示: 要約 + 出典リンク（`url`。外部リンクであることを明示）+
  「この判定は AI によるもので、誤りがあり得ます」の 1 行。

### ステップ 5: 判定履歴画面

ファイル: `src/app/rules/[sessionId]/news/page.tsx`（新規・既存のルール詳細の下層）

- そのルールに対する `news_assessments` を新しい順に表示（所有権チェック済みの API 経由）。
- `not_relevant` も薄い色で表示する（「AI が何を捨てたか」が見えると信頼できる。
  初心者の学習材料にもなる）。

## テスト

置き場所: `tests/features/news/`（新規）

必須ケース:

1. content_hash 重複記事が 2 回保存されない
2. 銘柄コード照合: タイトルに `7203` を含む記事が保有銘柄 7203 にマッチする /
   `17203` のような部分一致では**マッチしない**（単語境界の確認）
3. 会社名照合: 「トヨタ自動車」が company_name 一致でマッチする
4. 分類上限: 未判定 30 件あるとき 20 件しか `callAi` が呼ばれない（callAi をモックして回数検証）
5. `relevance: "not_relevant"` では要約 LLM が呼ばれない
6. LLM 出力のパース失敗時に assessment が保存されない
7. safety 不合格の要約が差し替え文言になる
8. ユーザー A の assessments がユーザー B の API から見えない（**所有権テスト**）
9. 通知文言が禁止語ゼロ
10. コスト上限超過時（402）に assess cron が該当ユーザーをスキップして続行する

## 完了条件

- [ ] mock プロバイダで fetch → assess → 通知の全経路が動く
- [ ] 分類・要約の件数上限とコスト上限の両方が機能する
- [ ] 通知に出典リンクと AI 免責が表示される
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
