# 02. 株価の自動取得基盤（PriceProvider・日次バッチ・鮮度表示）

## 目的

保有銘柄・ウォッチ銘柄の**日次終値（EOD）**を自動取得して保存し、
ポートフォリオ表示とルール条件判定（計画 06・07）が使える価格データを用意する。

方針:
- **リアルタイム価格は扱わない**。この製品は長期思考を促すため、日次終値で十分。
  API コストも運用も日次バッチ 1 本が最も安い。
- 既存の AI Provider Gateway（Mock/OpenAI/Gemini 切替）と同じ発想で、
  価格プロバイダも interface + 実装切替にする。テストは Mock で書く。

## 依存関係

- 計画 01（ポリシー改訂）が先。`docs/portfolio.md` のスコープ外リストが改訂済みであること。

## 最初に読むファイル

- `src/lib/ai/provider-factory.ts` と `src/lib/ai/provider.ts`（プロバイダ切替パターンの手本）
- `src/lib/db/sqlite-schema.ts`（テーブル明示定義の書き方）
- `src/app/api/cron/notifications/check/route.ts`（cron ルートの書き方）
- `src/features/portfolio/services/portfolio-position-service.ts`（ポジションの列名を確認する）
- `src/features/portfolio/services/portfolio-aggregation-service.ts`（評価額計算の現状）
- `src/features/watchlist/` のサービス（ウォッチ銘柄の列名を確認する）
- `src/lib/env.ts`（環境変数の追加パターン）

## やらないこと

- リアルタイム・分足・板情報の取得
- 証券会社連携
- 価格チャート表示（将来の計画。データを貯めるだけでよい）
- 通知の発火（stale 通知は本計画では**画面表示のみ**。通知化は計画 06 に含める）

## データモデル

`src/lib/db/sqlite-schema.ts` の `schemaStatements` に以下を**明示定義**で追加する
（unique 制約とインデックスが必要なため。自動作成に頼らない）。

```sql
create table if not exists price_quotes (
  id text primary key,
  symbol text not null,
  market text not null default 'JP',
  quote_date text not null,        -- 'YYYY-MM-DD'
  close_price real not null,
  currency text not null default 'JPY',
  source text not null,            -- 'mock' | 'stooq' など
  created_at text not null default (datetime('now')),
  unique (symbol, market, quote_date)
)
```

```sql
create table if not exists fx_rates (
  id text primary key,
  pair text not null,              -- 'USDJPY'
  rate_date text not null,         -- 'YYYY-MM-DD'
  rate real not null,
  source text not null,
  created_at text not null default (datetime('now')),
  unique (pair, rate_date)
)
```

インデックス:

```sql
create index if not exists idx_price_quotes_symbol_date on price_quotes(symbol, market, quote_date desc)
```

注意: `price_quotes` と `fx_rates` は**ユーザー所有データではない**（市場の公開データ）。
user_id 列は付けない。所有権チェックも不要。ただし書き込みは cron ルート経由のみとする。

## 実装ステップ

### ステップ 1: PriceProvider インターフェース

ファイル: `src/lib/prices/price-provider.ts`（新規）

```ts
import "server-only";

export type DailyQuote = {
  symbol: string;
  market: string;       // 'JP' | 'US' など。ポジションの market 列に合わせる
  quoteDate: string;    // 'YYYY-MM-DD'
  closePrice: number;
  currency: string;     // 'JPY' | 'USD'
};

export type FxRate = {
  pair: string;         // 'USDJPY'
  rateDate: string;
  rate: number;
};

export interface PriceProvider {
  readonly name: string;
  // 取得できなかった銘柄は結果から欠落させる（例外にしない）。
  // 呼び出し側が「欠落 = 未取得」として扱い、UI に明示する。
  fetchDailyQuotes(params: {
    symbols: Array<{ symbol: string; market: string }>;
  }): Promise<DailyQuote[]>;
  fetchFxRates(params: { pairs: string[] }): Promise<FxRate[]>;
}
```

### ステップ 2: Mock プロバイダ

ファイル: `src/lib/prices/providers/mock-price-provider.ts`（新規）

- 渡された全銘柄に対して決定的な値を返す（例: symbol の文字コード合計から算出）。
  テストが再現可能になるよう `Math.random()` は使わない。
- `quoteDate` は引数で注入できるようにする（デフォルトは今日）。

### ステップ 3: Stooq プロバイダ（無料・API キー不要）

ファイル: `src/lib/prices/providers/stooq-price-provider.ts`（新規）

- Stooq の CSV エンドポイント `https://stooq.com/q/l/?s=<symbol>&f=sd2t2ohlcv&h&e=csv` を fetch する。
- シンボル変換規則をコード内に定数で書く:
  - 日本株: `7203` → `7203.jp`
  - 米国株: `AAPL` → `aapl.us`
  - 為替: `USDJPY` → `usdjpy`
- CSV パースは自前で行い（依存追加しない）、`N/D` 行（データなし）は結果から除外する。
- HTTP エラー時はその銘柄を除外し、`console.warn` ではなく後述の取得結果サマリーに失敗数を含める。
- 1 リクエスト 1 銘柄なので、直列で 200ms 間隔を空けて呼ぶ（レート制限対策）。
  同時に取得する銘柄数の上限は 100 とする（定数 `MAX_SYMBOLS_PER_RUN`）。

### ステップ 4: プロバイダファクトリと環境変数

ファイル: `src/lib/prices/price-provider-factory.ts`（新規）

```ts
export function createPriceProvider(): PriceProvider {
  const providerName = process.env.PRICE_PROVIDER ?? "mock";
  if (providerName === "stooq") return new StooqPriceProvider();
  if (providerName === "mock") return new MockPriceProvider();
  throw new AppError("CONFIG_ERROR", `未知の PRICE_PROVIDER: ${providerName}`, 500, {});
}
```

- 環境変数 `PRICE_PROVIDER`（サーバ専用、`NEXT_PUBLIC_` 禁止）。未設定なら `mock`。
- `src/lib/env.ts` の既存パターンに追記する。

### ステップ 5: 価格保存サービス

ファイル: `src/lib/prices/price-quote-service.ts`（新規）

エクスポートする関数:

```ts
// upsert: unique(symbol, market, quote_date) 衝突時は上書き
export async function saveDailyQuotes(quotes: DailyQuote[]): Promise<{ savedCount: number }>;

// 指定銘柄の最新終値を返す。無ければ null（デフォルト値で埋めない）
export async function getLatestQuote(params: {
  symbol: string;
  market: string;
}): Promise<{ quote: DailyQuote | null; isStale: boolean }>;

// 複数銘柄の最新終値を一括取得（ポートフォリオ画面用）
export async function getLatestQuotes(params: {
  symbols: Array<{ symbol: string; market: string }>;
}): Promise<Map<string, { quote: DailyQuote | null; isStale: boolean }>>;
```

- `isStale` の定義: 最新 `quote_date` が **今日から数えて 4 暦日以上前**なら true
  （営業日計算は複雑になるため暦日で近似する。この近似は意図的）。
- 為替も同様に `saveFxRates` / `getLatestFxRate(pair)` を実装する。

### ステップ 6: 日次 cron ルート

ファイル: `src/app/api/cron/prices/daily/route.ts`（新規）

処理の流れ（`src/app/api/cron/notifications/check/route.ts` の形をコピーする）:

1. `assertValidCronRequest(request)` で保護。
2. 対象銘柄の収集: `portfolio_positions` と watchlist のテーブルから
   distinct な (symbol, market) を集める。実際の列名は
   `portfolio-position-service.ts` とウォッチリストのサービスを読んで確認すること。
3. `createPriceProvider().fetchDailyQuotes(...)` → `saveDailyQuotes(...)`。
4. `fetchFxRates({ pairs: ["USDJPY"] })` → `saveFxRates(...)`。
5. レスポンス: `apiSuccess({ requestedCount, savedCount, failedSymbols })`。
   `failedSymbols` は取得できなかった銘柄の配列（監視のため必ず返す）。

`vercel.json` に既存 cron 設定があるか確認し、同じ書式でこのルートを追加する
（実行時刻は JST 朝 7 時 = UTC 22 時を指定。日本市場と米国市場の両方の終値が揃った後）。

### ステップ 7: ポートフォリオ表示への組み込み

ファイル: `src/features/portfolio/services/portfolio-aggregation-service.ts`（変更）

- 各ポジションの評価に `getLatestQuotes` の結果を使う。
- **フォールバック禁止の適用**: 自動価格が無い銘柄は、既存の手動入力価格をそのまま使い、
  結果オブジェクトに `priceSource: "manual" | "auto"` と `priceAsOf: string | null` と
  `isStale: boolean` を追加する。UI コンポーネント側でこの 3 つを表示する
  （例: 「終値 2,150円（1/14時点）」「手動入力値」「⚠ 4日以上未更新」）。
- 表示コンポーネントの変更対象は `src/features/portfolio/components/` 配下。
  既存の評価額表示コンポーネントを探して、価格の隣に as-of 日付と stale バッジを追加する。

## テスト

置き場所: `tests/features/prices/`（新規フォルダ）と `tests/features/portfolio/`

必須ケース:

1. `MockPriceProvider` が同じ入力に対して常に同じ値を返す
2. `saveDailyQuotes` → `getLatestQuote` の往復。同一 (symbol, market, quote_date) の再保存で重複行ができない
3. `getLatestQuote` は quote_date が 4 日以上前なら `isStale: true` を返す
4. 価格が 1 件もない銘柄で `getLatestQuote` が `{ quote: null, isStale: false }` を返す（例外にならない）
5. Stooq の CSV パース: 正常系 1 ケース、`N/D` 行スキップ 1 ケース（fetch は vi.fn でモック）
6. cron ルート: `assertValidCronRequest` を通らないリクエストが 401/403 になる
7. aggregation: 自動価格あり → `priceSource: "auto"`、無し → `"manual"` になる

## 完了条件

- [ ] `PRICE_PROVIDER=mock` で cron ルートを叩くと保有銘柄の価格が保存される
- [ ] ポートフォリオ画面に価格の as-of 日付が表示され、未取得銘柄は「手動入力値」と表示される
- [ ] 4 日以上古い価格に stale 表示が出る
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test` が通る
- [ ] UI 変更を含むため `npm run test:e2e` を実行し、結果を PR に記載する
