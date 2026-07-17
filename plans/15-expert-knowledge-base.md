# 15. 専門家解説の共有ナレッジ基盤（段階導入・条件付き）

## 目的

信頼できる専門家による投資ルールの解説・教育コンテンツを、初心者の学習と
「わからない」時の補助に使えるようにする。

**この計画は 2 段階**で、フェーズ 2 には導入ゲート（下記）がある。
ゲートを満たすまでフェーズ 2 を実装してはならない。

- **フェーズ 1（すぐやる）**: キー参照の解説コンテンツ管理。RAG は使わない
- **フェーズ 2（条件付き）**: 分離された共有ナレッジの意味検索（共有 RAG）

フェーズ 2 の導入ゲート:
コンテンツが **300 件を超え**、かつ「キーワードで引けない自由質問への回答」が
実際のユーザー要望として確認できたとき。それまでは件数が少なく、
フェーズ 1 のキー参照で十分（ベクトル検索は不要な複雑さ）。

## 前提となる原則（計画 12 で確定済み）

- ユーザー所有 RAG（`retrieveRagContext`）に共有データを**混ぜない**。
  所有権チェックの単純さが安全性の根幹であり、そこに例外を作らない
- 共有ナレッジはテーブルも検索関数も完全に分離した**読み取り専用の別基盤**にする
- 掲載できるのは権利処理済みコンテンツのみ（許諾・ライセンス・自作・パブリックドメイン）。
  スクレイピングで集めない

## 依存関係

- フェーズ 1: なし（glossary 機能の拡張として独立実装可能）
- フェーズ 2: フェーズ 1 の運用実績と導入ゲートの成立

## 最初に読むファイル

- `src/features/glossary/` の全ファイル（フェーズ 1 の土台。データ形式と表示方法）
- `src/features/rules/constants/question-catalog.ts`（計画 04 の成果物。
  「わからない」時の解説との接続先）
- `src/lib/rag/chunk-text.ts` と `src/lib/ai/embeddings/`（フェーズ 2 で再利用する部品）
- `src/lib/auth/require-admin.ts`（コンテンツ管理は管理者専用）

## やらないこと

- 外部サイトの自動収集（権利処理済みコンテンツの手動登録のみ）
- 専門家コンテンツを根拠にした個別銘柄への示唆
  （解説は常に「一般的な知識」として表示し、AI が銘柄判断に転用しない）
- ユーザー投稿型のナレッジ共有（UGC はモデレーション体制ができるまで扱わない）
- フェーズ 2 の先行実装（導入ゲート前に共有 RAG を作らない）

## データモデル

`src/lib/db/sqlite-schema.ts` に明示定義で追加:

```sql
create table if not exists knowledge_articles (
  id text primary key,
  title text not null,
  body text not null,              -- Markdown。全文を自前で保持できる権利があるもののみ
  topic_keys text not null default '[]',  -- JSON配列。glossary の用語キーや質問 question_key と対応
  author_name text not null,       -- 執筆者・監修者の表示名
  source_name text,                -- 出典（書籍名・媒体名など）
  source_url text,
  license_note text not null,      -- 権利処理の記録（'自社作成' '著者許諾 2026-07-01' など）。必須
  published_at text,
  is_active integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
)
```

- `license_note` を **not null** にするのは意図的: 権利処理の記録が無いコンテンツを
  構造的に登録できなくするため。
- 共有データなので user_id なし。**書き込みは admin のみ、読み取りは全ユーザー**。

フェーズ 2 で追加（ゲート成立まで作らない）:

```sql
create table if not exists knowledge_chunks (
  id text primary key,
  article_id text not null,
  content text not null,
  embedding text,                  -- 既存 RAG チャンクと同じ形式
  created_at text not null default (datetime('now'))
)
```

## 実装ステップ（フェーズ 1）

### ステップ 1: コンテンツ管理（admin）

- サービス: `src/features/knowledge/services/knowledge-article-service.ts`（新規）。
  CRUD + `listActiveArticlesByTopic(topicKey)`。
- API: `src/app/api/admin/knowledge/route.ts`（GET / POST、`requireAdmin`）と
  `.../knowledge/[articleId]/route.ts`（PATCH / DELETE = is_active 切替）。
  一般ユーザー向け読み取りは `src/app/api/knowledge/route.ts`（GET、`requireUser`、
  `is_active = 1` のみ返す）。
- admin 画面: 既存 `src/app/admin/` のパターンで登録・編集ページを 1 枚。
  `license_note` 未入力では保存できないことを UI でも明示する。

### ステップ 2: 「わからない」との接続（キー参照）

計画 04 の質問ウィザードで「まだ決めていない」を選んだとき、
デフォルト提案カードに「もっと詳しく」リンクを追加する:

- 質問の `question_key` と `knowledge_articles.topic_keys` をキー照合し、
  該当記事があれば一覧表示する（**検索ではなく完全一致のキー参照**。RAG 不使用）。
- 記事表示には必ず `author_name` / `source_name` / `published_at` を出典として表示し、
  末尾に固定文を付ける: 「この解説は一般的な知識の説明であり、
  特定の銘柄の売買を勧めるものではありません。」

### ステップ 3: glossary との整理

- 用語（1 語 1 定義）は既存 glossary のまま。knowledge_articles は
  「まとまった解説」（数百字〜数千字）を担当する、と役割を
  `docs/glossary.md` に追記する。glossary の用語ページから関連記事への
  リンク（topic_keys 照合）を追加する。

## 実装ステップ（フェーズ 2・導入ゲート成立後のみ）

概要だけ定義しておく（詳細設計はゲート成立時に別途）:

1. `knowledge_chunks` を作り、`chunk-text.ts` と埋め込みプロバイダで索引
2. 検索関数は `retrieveSharedKnowledge(queryText)` として**新規に作る**
   （`retrieveRagContext` に混ぜない。引数に userId を取らないことが
   「ユーザーデータに触れない」ことの型レベルの表明になる）
3. 利用箇所は「教育コンテンツの検索ボックス」と「わからない」ヘルプの拡張のみ。
   ルールレビュー・仮説下書き・ニュース判定には**注入しない**
   （専門家の一般論が特定銘柄の判断文脈に混ざると、事実と意見の境界が崩れるため）
4. 検索結果の表示は常に記事単位（出典付き）。チャンク断片だけを見せない

## テスト

置き場所: `tests/features/knowledge/`（新規）

必須ケース（フェーズ 1）:

1. `license_note` なしの insert がバリデーションで失敗する
2. 一般ユーザーの読み取り API が `is_active = 0` の記事を返さない
3. admin API が一般ユーザーで 403 になる
4. topic_keys のキー照合: question_key に対応する記事だけが返る（部分一致しない）
5. 記事表示に出典 3 点（author / source / published_at）と免責文が含まれる（コンポーネントテスト）

## 完了条件（フェーズ 1）

- [ ] admin が権利記録付きで解説記事を登録・無効化できる
- [ ] ウィザードの「まだ決めていない」から該当解説に到達できる
- [ ] すべての記事表示に出典と免責文が付く
- [ ] 共有 RAG（フェーズ 2）のコードが存在しない（導入ゲート前）
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
