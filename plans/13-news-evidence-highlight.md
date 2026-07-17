# 13. ニュース判定の根拠引用と該当箇所ハイライト付き出典リンク

## 目的

ニュース判定（計画 08、実装済み）の結果を表示するとき、
**「記事のどの記述を根拠に判定したか」**を逐語引用で示し、
出典リンクを**該当箇所がハイライトされた状態で開く**ようにする。

得られる価値:

1. ユーザーは AI の判定を鵜呑みにせず、根拠を 1 タップで原文確認できる
2. 引用は**コードで原文との逐語一致を検証**するため、LLM の捏造引用がユーザーに届かない
3. ハイライトは URL テキストフラグメント（`#:~:text=`）なので外部ライブラリ不要、
   非対応ブラウザでも通常リンクとして開くだけで壊れない

## 依存関係

- 計画 08 の実装（ブランチ `codex/phase-c-auto-monitoring`）が前提。
  **この計画はそのブランチ（またはマージ先）の上に実装する。**
  この計画に書いたファイルパスと関数名は同ブランチの実装を参照している。

## 最初に読むファイル（すべて実装済みの実ファイル）

- `src/schemas/news/news-schema.ts`（`NewsClassificationSchema` を拡張する）
- `src/features/news/services/news-assess-service.ts`
  （`classifyNews` / `summarizeNews` / `assessNewsForAllUsers` の流れと、
  `news_assessments` への insert 箇所を確認する）
- `src/features/news/components/news-assessment-history.tsx`（表示 UI の変更対象）
- `src/app/api/rules/[sessionId]/news/route.ts`（判定履歴 API。返却列の追加）
- `src/lib/db/sqlite-schema.ts`（`news_assessments` の定義と `ensureColumn` の使い方）
- 通知詳細の表示コンポーネント（`news_thesis_impact` 通知の詳細カードがどこで
  描画されているかを `notification` で grep して特定する）

## やらないこと

- 記事全文の取得・保存（引用の対象は既に保存済みの `title` + `summary` のみ。
  著作権と取得コストの方針は計画 08 から変えない）
- 過去の既存 `news_assessments` 行への遡及付与（引用は新しい判定から付く。
  過去分は引用なし表示のままでよい）
- 要約（`summarizeNews`）側への引用追加（根拠引用は分類の出力で十分。
  LLM 呼び出しを増やさない）

## データモデル

`news_assessments` テーブルは実装済みのため、`create table` 文の変更では既存 DB に
列が追加されない。`src/lib/db/sqlite-schema.ts` の `initializeSqliteSchema` にある
既存の `ensureColumn` 呼び出し群に追加する:

```ts
ensureColumn(db, "news_assessments", "evidence_quote", "text");
ensureColumn(db, "news_assessments", "evidence_verified", "integer not null default 0");
```

- `evidence_quote`: 判定根拠となる記事内の逐語引用。**検証に合格した場合のみ**値が入る
- `evidence_verified`: 引用が原文に実在することをコードで確認済みなら 1

あわせて `schemaStatements` 内の `news_assessments` の `create table` 文にも
同じ 2 列を追記する（新規 DB とテスト DB のため。両方やることを忘れない）。

## 実装ステップ

### ステップ 1: 分類スキーマの拡張

ファイル: `src/schemas/news/news-schema.ts`（変更）

`NewsClassificationSchema` にフィールドを 1 つ追加する:

```ts
export const NewsClassificationSchema = z.object({
  relevance: z.enum(["affects_thesis", "not_relevant"]),
  thesisRelation: z.enum(["supports", "challenges", "unclear"]).optional(),
  matchedBreakerIndex: z.number().int().min(0).max(9).nullable(),
  reason: z.string().max(200),
  // 判定根拠として、記事のタイトルまたは要旨から「一字一句そのまま」抜き出した引用。
  // 言い換え・要約・複数箇所の結合は禁止（プロンプトに明記する）
  evidenceQuote: z.string().max(300).nullable(),
});
```

`optional()` ではなく `nullable()` にする理由: LLM に「根拠が示せないなら null を返す」
という明示的な選択をさせるため（フィールド省略による曖昧さを避ける）。
既存プロンプトの応答例（few-shot がある場合）にも `evidenceQuote` を追記する。

### ステップ 2: 分類プロンプトの変更

ファイル: `src/features/news/services/news-assess-service.ts` の `classifyNews`（変更）

プロンプトに追加する指示（日本語でよい。既存プロンプトの言語に合わせる）:

- 「evidenceQuote には、判定の根拠になった箇所を記事のタイトルまたは要旨から
  **一字一句そのまま**抜き出して入れること。言い換え・要約・省略記号による連結は禁止。
  30〜100 文字程度の連続した一節を選ぶこと。根拠となる箇所が特定できない場合は null にすること。」

### ステップ 3: 逐語検証（決定的・無料）

ファイル: `src/lib/news/verify-evidence-quote.ts`（新規・純関数）

```ts
// LLM が返した引用が原文（title + "\n" + summary）に実在するかを検証する。
// 正規化は空白の揺れのみ許可: 連続する空白文字（全角スペース含む）を半角スペース
// 1 つに畳んでから includes で判定する。それ以外の差異（言い換え・句読点変更）は不合格。
export function verifyEvidenceQuote(params: {
  quote: string;
  articleText: string;
}): boolean;
```

`assessNewsForAllUsers` 内の `news_assessments` insert 箇所で:

- 検証合格 → `evidence_quote: quote, evidence_verified: 1`
- 不合格（捏造・言い換え）または null → `evidence_quote: null, evidence_verified: 0`。
  判定そのもの（relevance / thesisRelation）は破棄しない——引用の検証失敗は
  「根拠表示ができない」だけで、判定が誤りとは限らないため。
  ただし不合格件数は cron レスポンスのカウンタに含める（分類品質の監視指標になる）。

### ステップ 4: ハイライト付き URL の生成（決定的・無料）

ファイル: `src/lib/news/build-highlight-url.ts`（新規・純関数）

```ts
// 検証済み引用があるときだけテキストフラグメント付き URL を返す。
// それ以外は元の url をそのまま返す（未検証の引用に偽のハイライトを付けないため）。
export function buildHighlightUrl(params: {
  url: string;
  evidenceQuote: string | null;
  evidenceVerified: boolean;
}): string;
```

生成規則（順に適用）:

1. `evidenceQuote` が null、または `evidenceVerified` が false → `url` をそのまま返す
2. `url` に既存の `#` フラグメントがあれば除去する
3. 引用が 100 文字以下 → `${url}#:~:text=${encode(quote)}`
4. 引用が 100 文字超 → 先頭 20 文字と末尾 20 文字で範囲指定形式
   `#:~:text=${encode(head)},${encode(tail)}` を使う
   （長い完全一致はブラウザ側のマッチングが失敗しやすいため）
5. `encode` は `encodeURIComponent` の結果に対し、テキストフラグメントの
   区切り記号を追加エスケープする: `-` → `%2D`、`,` → `%2C`、`&` → `%26`

### ステップ 5: UI 表示

対象 1: `src/features/news/components/news-assessment-history.tsx`（変更）

- `affects_thesis` の判定カードに、検証済み引用があれば引用ブロックを表示:
  引用文 + 出典名。その下にリンク「出典で該当箇所を見る ↗」
  （`buildHighlightUrl` の結果。`target="_blank"` + `rel="noopener noreferrer"`）。
- `evidence_verified = 0` の場合は引用ブロックを出さず、
  リンクは従来どおり「出典を見る ↗」（素の `url`）。
- 引用ブロックの下に小さく注記: 「ハイライト表示はブラウザによっては機能しません」。

対象 2: `news_thesis_impact` 通知の詳細カード（最初に読むファイルで特定した場所）

- 同じ引用ブロック + リンクを表示する。表示コンポーネントは
  `src/features/news/components/evidence-quote-block.tsx`（新規）として共通化し、
  両方から使う。

対象 3: `src/app/api/rules/[sessionId]/news/route.ts`（変更）

- レスポンスの select 列に `evidence_quote, evidence_verified` を追加する
  （所有権チェックは既存実装のまま）。

## テスト

置き場所: `tests/features/news/`（既存フォルダ。既存テストの書き方に合わせる）

必須ケース:

1. `verifyEvidenceQuote`: 逐語一致 → true
2. `verifyEvidenceQuote`: 言い換え（1 文字でも違う）→ false
3. `verifyEvidenceQuote`: 全角/連続空白の揺れのみ → true
4. 分類出力の `evidenceQuote` が原文に無い場合、`evidence_quote` が null・
   `evidence_verified` が 0 で保存され、relevance は保存される
5. `buildHighlightUrl`: 検証済み短文 → `#:~:text=` 付き URL
6. `buildHighlightUrl`: 未検証 → 素の URL のまま
7. `buildHighlightUrl`: ハイフン・カンマを含む引用が `%2D` / `%2C` にエンコードされる
8. `buildHighlightUrl`: 100 文字超の引用が範囲指定形式（`,` 区切り）になる
9. `buildHighlightUrl`: 既存フラグメント付き URL（`...#section`）のフラグメントが置換される
10. 判定履歴 API のレスポンスに新 2 列が含まれ、他ユーザーからは見えない（**所有権テスト**は既存を流用しつつ列追加分を確認）

E2E（既存のニュース E2E があれば追加、無ければ省略可）:

11. 検証済み引用のある判定カードに引用ブロックとハイライトリンクが表示される

## 完了条件

- [ ] 新しい判定から、検証済み引用が保存・表示される
- [ ] 出典リンクが該当箇所ハイライト付き（`#:~:text=`）で開く（Chrome で手動確認）
- [ ] 捏造引用（原文に無い引用）がユーザーに一切表示されない
- [ ] 引用なし・未検証の判定は従来どおりの表示で壊れない（過去データ含む）
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test` が通る
- [ ] UI 変更のため `npm run test:e2e` を実行し、結果を PR に記載する
