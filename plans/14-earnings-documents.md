# 14. 決算資料の取り込みと参照（documents 連携 + EDINET 数値）

## 目的

決算資料を「仮説の検証材料」としてアプリに取り込み、AI の文脈とユーザーの画面の両方で
使えるようにする。取得方法は情報の性質で分ける:

- **テキスト**（経営方針・リスク情報・事業説明）→ ユーザー所有の RAG（意味検索に価値がある）
- **数値**（売上・利益・EPS など）→ SQL（ticker + 会計期間のキーで引く。ベクトル検索は誤り）

**既にあるもの（再実装しないこと）**:

- documents 機能一式: `src/features/documents/services/`
  （upload / extraction / index / summary / link / delete）
- アップロード文書は `document-index-service.ts` が `sourceType: "manual_note"` で
  既存 RAG に索引済み（つまり文書→RAG の配管は開通している）
- `document-link-service.ts` が文書と対象（target_type / target_id）の紐付けに対応済み
- プライバシー削除: `/api/privacy/delete/document` が存在する

**足りないもの（この計画で作る）**:

1. 文書の「種別」と「会計期間」の概念（決算資料をメモと区別し、鮮度を管理する）
2. 決算資料チャンクのルールレビュー・仮説下書きへの注入（最新期フィルタ付き）
3. 財務数値の SQL 基盤（`financial_statements`）と EDINET からの取得

## 依存関係

- なし（documents 機能は develop に実装済み）。
  ステップ 3 の注入先のうち thesis-draft は計画 04 の実装（phase-b）に依存。

## 最初に読むファイル

- `src/features/documents/services/document-index-service.ts`
  （`sourceType: "manual_note"` の付き方。この計画で分岐を足す）
- `src/features/documents/services/document-upload-service.ts`（`user_documents` の列）
- `src/features/documents/services/document-link-service.ts`（target_type の語彙）
- `src/features/rag/services/retrieve-rag-context.ts`（sourceTypes 絞り込みの仕組み）
- `src/features/rules/services/rule-review-service.ts` の `retrieveRagContext` 呼び出し
  （sourceTypes: investor_profile / rule_session / rule_review / watchlist_item /
  portfolio_position の 5 種。ここに追加する）

## やらないこと

- 決算資料 PDF の全ユーザー向け自動配布（開示書類でも、全文の再配布はしない。
  文書は各ユーザーが自分の判断材料としてアップロードしたものとして扱う）
- 業績予想の生成・評価（「来期は増益が見込まれます」は売買示唆に近づくため禁止。
  表示するのは開示された事実のみ）
- XBRL の全項目パース（v1 は主要 6 項目のみ。下記データモデル参照）
- 決算スケジュール通知（既存の earningsPolicy / レビュー周期の枠組みで扱う）

## データモデル

### 文書側（既存テーブルへの列追加）

`src/lib/db/sqlite-schema.ts` の `ensureColumn` 群に追加:

```ts
ensureColumn(db, "user_documents", "document_kind", "text not null default 'note'");
// 'note'（既定・従来どおり） | 'earnings_report'（決算資料）
ensureColumn(db, "user_documents", "fiscal_period", "text");
// 決算資料のみ必須。形式: 'FY2025' または 'FY2025Q1' のような文字列。zod で検証
ensureColumn(db, "user_documents", "ticker", "text");
// 決算資料のみ必須。どの銘柄の資料か
```

### 数値側（新テーブル・明示定義。unique 制約が必要）

```sql
create table if not exists financial_statements (
  id text primary key,
  ticker text not null,
  market text not null default 'JP',
  fiscal_period text not null,     -- 'FY2025Q1' 形式
  revenue real,
  operating_income real,
  net_income real,
  eps real,
  dividend_per_share real,
  equity_ratio real,
  currency text not null default 'JPY',
  source text not null,            -- 'edinet' | 'mock' | 'manual'
  filed_at text,                   -- 開示日
  created_at text not null default (datetime('now')),
  unique (ticker, market, fiscal_period, source)
)
```

`financial_statements` は公開開示情報なので **user_id なしの共有データ**
（`price_quotes` と同じ扱い。書き込みは cron / admin 経由のみ）。

## 実装ステップ

### ステップ 1: 決算資料としてのアップロード

- アップロード UI（既存の documents 画面）に「文書の種別」選択を追加:
  「メモ・その他（既定）」「決算資料」。決算資料を選ぶと ticker（保有・ウォッチから選択）と
  会計期間（'FY2025' + 任意で Q1〜Q4）の入力が必須になる。
- `document-upload-service.ts` に 3 列を渡す。zod スキーマ:
  `documentKind: z.enum(["note", "earnings_report"]).default("note")`、
  `fiscalPeriod: z.string().regex(/^FY\d{4}(Q[1-4])?$/).optional()`（earnings_report 時は必須。
  `superRefine` で相関チェック）。
- アップロード後、`document-link-service` で該当 ticker のルールセッションに自動リンクする
  （セッションが無ければリンクなしで保存。エラーにしない——資料が先、ルールが後の順は正常系）。

### ステップ 2: 索引の分離と鮮度管理

ファイル: `src/features/documents/services/document-index-service.ts`（変更）

- `document_kind === "earnings_report"` の文書は `sourceType: "earnings_report"` で索引する
  （従来の `manual_note` と分離。検索側で決算資料だけを狙えるようにするため）。
- チャンクの metadata（既存のチャンク保存形式を確認して、列があれば列、なければ
  content 先頭への構造化プレフィックス）に `ticker` と `fiscal_period` を含める。
- **鮮度管理**: 同一 (user, ticker) でより新しい `fiscal_period` の決算資料を索引したとき、
  古い期の `earnings_report` チャンクを索引から削除する（`user_documents` の原本は残す。
  reindex で常に「最新期のみ索引」という不変条件を再現できるようにする）。
  古い決算内容が検索で現在の文脈に混入する「鮮度事故」を防ぐのが目的（コメントに書く）。
- `reindex-user-rag-documents.ts` に earnings_report の再構築を追加する。
- プライバシー削除（document 削除・rag-memory 削除）が earnings_report チャンクも
  消すことをテストで保証する。

### ステップ 3: AI 文脈への注入

- `rule-review-service.ts` の `retrieveRagContext` の `sourceTypes` に
  `"earnings_report"` を追加する。
- thesis-draft（計画 04 の `thesis-draft-service.ts`）の検索（計画 12 ステップ 3）にも
  `"earnings_report"` を追加する。
- プロンプトに追加する制約: 「決算資料からの参照は事実の引用に限る。
  業績の見通しを述べたり、資料を根拠に売買の示唆をしてはならない」。

### ステップ 4: 財務数値の取得基盤

計画 02 の PriceProvider と同じパターンで作る:

- `src/lib/financials/financials-provider.ts`（新規）:

```ts
export type FinancialStatement = {
  ticker: string;
  market: string;
  fiscalPeriod: string;   // 'FY2025Q1'
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  dividendPerShare: number | null;
  equityRatio: number | null;
  currency: string;
  filedAt: string | null;
};

export interface FinancialsProvider {
  readonly name: string;
  // 指定銘柄の「新しく開示された」決算数値を返す。無ければ空配列
  fetchNewStatements(params: {
    tickers: string[];
    sinceDate: string;   // 'YYYY-MM-DD'
  }): Promise<FinancialStatement[]>;
}
```

- `mock-financials-provider.ts`: 決定的なダミー値（テスト用）。
- `edinet-financials-provider.ts`: EDINET API（金融庁・無料・API キーは v2 で必要、
  環境変数 `EDINET_API_KEY`）で書類一覧 API → 有報/四半期報告の XBRL から主要 6 項目を抽出。
  **XBRL パースは最小限**にする: 対象要素は日本基準の代表的タグ
  （NetSales / OperatingIncome / ProfitLossAttributableToOwnersOfParent /
  BasicEarningsLossPerShare など）に限定し、取れない項目は null で保存する
  （null は「未取得」の明示であり、0 で埋めてはならない）。
  実装が大きくなりすぎる場合は、v1 を mock + manual（admin 入力 API）のみとし、
  EDINET 実装を別 PR に分けてよい（その判断を PR に明記）。
- ファクトリ: 環境変数 `FINANCIALS_PROVIDER`（既定 `mock`）。
- cron: `src/app/api/cron/financials/weekly/route.ts`（新規、週 1 回）。
  保有 + ウォッチ銘柄について `fetchNewStatements` → `financial_statements` に upsert。

### ステップ 5: 表示と月次レビューへの接続

- ルールセッション詳細ページに「最新の決算数値」カードを追加:
  `financial_statements` から該当 ticker の最新期を表示（売上・営業利益・純利益・EPS、
  開示日と出典 'EDINET' を明記）。数値が無い場合は「未取得」と表示（0 やハイフンで
  ごまかさない）。前期比の増減率は決定的コードで計算して表示してよいが、
  評価語（好調・堅調・悪化など）は付けない。
- 月次総合レビュー（計画 09 の `holistic-review-service.ts`）の入力データに
  「保有銘柄の最新期の主要数値」を追加する（LLM に渡す事実を増やす。
  数値の計算・比較は決定的コードで済ませてから渡す方針は計画 09 と同じ）。

## テスト

置き場所: `tests/features/documents/`（既存）と `tests/features/financials/`（新規）

必須ケース:

1. earnings_report のアップロードで fiscal_period / ticker 必須が効く
   （note では不要のまま）
2. earnings_report が `sourceType: "earnings_report"` で索引され、
   `manual_note` としては検索にヒットしない
3. 新しい期を索引すると同一 (user, ticker) の古い期チャンクが検索から消える
4. reindex 後も「最新期のみ索引」が保たれる
5. 文書削除・rag-memory 削除で earnings_report チャンクが消える（**プライバシー**）
6. ユーザー A の決算資料チャンクがユーザー B の検索に出ない（**所有権テスト**）
7. `financial_statements` の upsert: 同一 (ticker, market, fiscal_period, source) が重複しない
8. mock プロバイダで cron が動き、取れない項目が null で保存される（0 にならない）
9. 決算数値カード: データ無し銘柄で「未取得」表示になる

## 完了条件

- [ ] 決算資料をアップロードすると、最新期のテキストがルールレビューの参照に使われる
- [ ] 古い期の決算内容が AI の文脈に混入しない（鮮度フィルタ）
- [ ] 銘柄ページに最新期の主要数値が出典付きで表示される（評価語なし）
- [ ] 数値は SQL、テキストは RAG という分離が実装で守られている
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
