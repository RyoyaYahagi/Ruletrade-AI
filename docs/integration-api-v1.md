# 窓口 API v1 仕様

- 状態: v1 仕様固定（R-01）。実装は R-02〜R-08 で行う
- 対象: `RyoyaYahagi/Ruletrade-AI` の SQLite 台帳と Muse の連携
- 実装 Issue: #212（この文書）、R-02〜R-08（実装）
- 正本: この文書

この文書が窓口 API v1 の仕様の正である。設計メモ（`design-memo.md`）と食い違う箇所は、R-01 着手時に決定した調整（末尾「設計メモからの変更点」）を反映済みである。

## 1. 位置づけと前提

### 1.1 目的

台帳側（このアプリ）と Muse 側が独立に実装できるよう、連携の契約を先に固定する。Muse はこの文書だけを参照して、読み取り CLI と書き戻し CLI を実装できる。

### 1.2 対象と境界

- 窓口の相手は Muse のみとする。他の AI 向けの汎用 API にはしない。
- 正本はこのアプリの SQLite（`.data/ruletrade-mvp.sqlite`）である。窓口 API は SQLite の読み書きの入口であり、別の保存先を持たない。
- 読み取りと「確認済みの確定書き込み」だけを提供する。下書き状態は持たない。確認はチャット側（Muse）の責務とする。
- 売買の新規登録 API は作らない。売買の正は証券 CSV 取込と既存画面である。
- 判断・振り返りは新規作成のみ（追記型）。窓口 API に判断・振り返りの更新・削除は持たせない。
- 銘柄を新規作成する手段は書き込み API に持たせない。`stockId` は既存銘柄のみを受け付ける。
- AI（Gemini / Jev）関連の処理には触れない。窓口 API は AI を呼ばない。

### 1.3 やらないこと

- 売買の新規登録、判断・振り返りの更新・削除
- 下書き・確認待ち状態の保存
- 銘柄の新規作成
- 他の AI 向けの汎用化、公開 API 化
- Web UI の認証追加、複数ユーザー対応
- CORS の提供（Muse はサーバー間通信で使う）
- レート制限、ページング、全文検索（必要になった時点で別 Issue）

### 1.4 実装 Issue の対応

| エンドポイント                         | 実装 Issue | 備考                                       |
| -------------------------------------- | ---------- | ------------------------------------------ |
| `GET /status`                          | R-03       | 集計のみ                                   |
| `GET /holdings`                        | R-03       | `realizedProfitLoss` は R-06 で埋める      |
| `GET /stocks`                          | R-03       | 既存クエリの再利用                         |
| `GET /stocks/:id`                      | R-03       | 銘柄詳細画面のデータ取得を共通化           |
| `GET /transactions`                    | R-03       | 絞り込み付き                               |
| `GET /due`                             | R-04       | 「今日」画面の判定ロジックを共通化して共用 |
| `GET /captures`                        | R-07       | 受け箱の読み取り                           |
| `GET /realized-pnl`                    | R-06       | 実現損益の専用レスポンス                   |
| `POST /captures`                       | R-07       | 受け箱への追記                             |
| `POST /decisions`                      | R-08       | 整理済み判断の新規登録                     |
| `POST /transactions/:id/decision-link` | R-08       | 売買と判断の紐付け                         |
| `POST /reviews`                        | R-08       | 振り返りの新規登録                         |

## 2. 共通仕様

### 2.1 ベースパスと文字コード

- ベースパスは `/api/integration/v1`。
- 実環境の例: `https://yappa-inspiron-5415.tail1fde47.ts.net:9445/api/integration/v1`
- リクエスト・レスポンスは JSON。`Content-Type: application/json; charset=utf-8`。
- すべてのレスポンスに `Cache-Control: no-store` を付ける。
- 成功レスポンスは HTTP 200 または 201。それ以外はエラー形式（§2.4）で返す。
- クエリの未知のパラメータは無視する（前方互換のため）。ただし既知のパラメータの値が不正な場合は 400 とする。

### 2.2 認証

`Authorization: Bearer <token>` で認証する。トークンは読み取り用と書き込み用で分離する。

| 環境変数                | 使える操作                    | 置き場所                                  |
| ----------------------- | ----------------------------- | ----------------------------------------- |
| `RULETRADE_READ_TOKEN`  | `GET` 系のみ                  | サーバーの `.env.local`（Git に入れない） |
| `RULETRADE_WRITE_TOKEN` | `POST` 系のみ（読み取り不可） | サーバーの `.env.local`（Git に入れない） |

- 読み取りエンドポイントは `RULETRADE_READ_TOKEN` だけを受け付ける。
- 書き込みエンドポイントは `RULETRADE_WRITE_TOKEN` だけを受け付ける。
- 書き込みトークンでは読めず、読み取りトークンでは書けない。スコープ違いは 401 `unauthorized`。
- トークンなし・不一致・スコープ違いは、すべて 401 `unauthorized` とする（R-03 / R-08 の受け入れ条件）。
- トークンの比較は定数時間で行う。両方を SHA-256 でハッシュ化し、`crypto.timingSafeEqual` で比較する（長さの差も漏らさない）。
- 401 のレスポンスには `WWW-Authenticate: Bearer` を付ける。
- トークンの値はログ・レスポンス・エラーメッセージに含めない。
- Muse 側へは Secure Vault 経由で渡し、チャット本文やファイルに値を書かない。
- 読み取りトークンと書き込みトークンに同じ値を設定しない（スコープ分離が壊れる）。

`Authorization` ヘッダがない、`Bearer` で始まらない、トークンが空、のいずれも 401 とする。`Bearer` の綴りは大文字小文字を区別しない。

### 2.3 トークン未設定時の扱い（スコープ別）

トークンが設定されていない環境では、そのスコープの窓口 API を無効にする。Web UI には影響させない。

| 設定状態                                                   | 読み取りエンドポイント   | 書き込みエンドポイント   |
| ---------------------------------------------------------- | ------------------------ | ------------------------ |
| `RULETRADE_READ_TOKEN` も `RULETRADE_WRITE_TOKEN` も未設定 | 404 `not_found`          | 404 `not_found`          |
| `RULETRADE_READ_TOKEN` だけ未設定                          | 404 `not_found`          | トークンが一致すれば動作 |
| `RULETRADE_WRITE_TOKEN` だけ未設定                         | トークンが一致すれば動作 | 404 `not_found`          |

- 無効なスコープは、存在しないパスと同じ 404 `{"error":{"code":"not_found","message":"リソースが見つかりません。"}}` を返す。パスの存在を区別しない。
- 読み取り（R-03）が書き込み（R-08）より先にリリースされるため、スコープ別に無効化できるようにする。
- 必須トークンが未設定の場合は、`Authorization` ヘッダの有無にかかわらず 404 を返す（401 より先に判定する）。

### 2.4 共通レスポンス形式とエラー形式

成功レスポンスは、一覧・単体・書き込みのすべてで次の形に統一する。

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {}
}
```

- `generatedAt`: レスポンスを生成した時刻。ISO 8601 の UTC（ミリ秒あり）。一覧・単体・書き込みのすべてに付ける。
- `data`: エンドポイントごとの本体。一覧は配列フィールドを持つオブジェクト、単体はオブジェクト、書き込みは `replayed` と作成・更新したリソースを含む。

エラーは次の形に統一する。`generatedAt` は含めない。

```json
{
  "error": {
    "code": "validation_error",
    "message": "clientRequestId は UUID 形式で指定してください。"
  }
}
```

- `code`: 機械可読なエラーコード（§2.5）。クライアントは `code` で分岐する。
- `message`: 人向けの説明。文言は変更されうるので、分岐に使わない。
- スタックトレース、SQL、トークン、内部パスは返さない。

### 2.5 エラーコード一覧

| code                     | HTTP | 意味                                                              |
| ------------------------ | ---- | ----------------------------------------------------------------- |
| `unauthorized`           | 401  | トークンなし・不一致・スコープ違い                                |
| `not_found`              | 404  | リソースが存在しない、または必須トークン未設定でスコープが無効    |
| `validation_error`       | 400  | JSON 不正、必須欠落、型・形式・値の不正、条件の矛盾               |
| `method_not_allowed`     | 405  | パスは存在するがメソッドが違う（`PATCH` / `PUT` / `DELETE` など） |
| `idempotency_key_reused` | 409  | 同じ `clientRequestId` を別の本文または別のエンドポイントで使った |
| `capture_not_pending`    | 409  | 受け箱がすでに `organized` または `discarded`                     |
| `internal_error`         | 500  | サーバー内部のエラー。詳細は返さない                              |

### 2.6 HTTP ステータスの使い分け

| 状況                                                | ステータス |
| --------------------------------------------------- | ---------- |
| 読み取り成功                                        | 200        |
| 書き込み成功（新規作成）                            | 201        |
| 書き込み成功（`decision-link`。新しい行を作らない） | 200        |
| 冪等キーの再送（何も書かない）                      | 200        |
| 入力の検証エラー                                    | 400        |
| 認証エラー                                          | 401        |
| リソースなし・スコープ無効                          | 404        |
| メソッド違い                                        | 405        |
| 冪等キーの再利用・受け箱の状態衝突                  | 409        |
| サーバー内部エラー                                  | 500        |

### 2.7 出所（`origin`）

`decisions` / `reviews` / `captures` は出所を `origin` で持つ。R-02 で列を追加する。

| 値     | 意味                                                          |
| ------ | ------------------------------------------------------------- |
| `web`  | Web UI から保存された記録。既存レコードはすべてこれとして扱う |
| `muse` | 窓口 API から保存された記録                                   |

- 窓口 API の書き込みは、サーバー側で常に `origin = "muse"` を記録する。リクエストで `origin` は指定しない。
- 既存の `decisions` / `reviews` は R-02 のマイグレーションで `"web"` にする。
- `captures` の出所列は、設計メモの `source` ではなく `origin` に名前を揃える（§8-4）。
- `GET /stocks/:id` のタイムラインと `GET /captures` は `origin` を返す。Muse は Web 由来の記録と自分の書き戻しを区別できる。

### 2.8 金額の表し方

金額は必ず通貨を併記し、次の形に統一する。

```json
{ "amount": 280000, "currency": "JPY" }
```

```json
{ "amount": 1650.5, "currency": "USD" }
```

- `amount`: 数値。不明な場合は `null`。
- `currency`: `"JPY"` または `"USD"`。通貨が不明な場合（手入力の売買、異なる通貨の取引が混在、過売却など）だけ `null` を許す。
- 価格・取得額・評価額・損益が不明な場合は、金額オブジェクト自体を `null` にする（例: `"price": null`）。
- 円とドルの換算・合算はしない。通貨を跨いだ合計フィールドは作らない。
- 合計は `totalsByCurrency` のような通貨ごとの配列で返す。JPY と USD を足した単一の合計は返さない。
- 小数の丸めは API では行わない。画面表示用の丸め（`src/features/portfolio/format.ts`）は API の値には適用しない。

### 2.9 日時の表し方

既存データの形式に合わせ、日付だけの値と日時を区別する。

| 種類     | 形式                          | 例                         | 使うフィールド                                                                     |
| -------- | ----------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| 日付だけ | `YYYY-MM-DD`（JST の暦日）    | `2026-11-07`               | `decidedAt`、`dueOn`、`occurredOn`、`lastDecidedOn`                                |
| 日時     | ISO 8601 の UTC（ミリ秒あり） | `2026-11-07T12:00:00.000Z` | `createdAt`、`executedAt`、`reviewAt`、`reviewDates`、`organizedAt`、`generatedAt` |

- `decidedAt` は日付だけ（`z.iso.date()`）。既存データでも `YYYY-MM-DD`。
- `reviewAt` / `reviewDates` は日時。画面の日付指定は `T12:00:00.000Z` として保存される。1か月後・3か月後のプリセットは任意の時刻になる。クライアントは「日付だけ」とみなさず、必要なら JST に変換して暦日を求める。
- CSV 取込の `executedAt` と `settlementDate` も `T12:00:00.000Z` で保存される。`settlementDate` は列名に反して日時である。
- `decidedAt` が `null` の既存レコード（列追加前のデータ）では、クライアントは `createdAt` を日付の代替に使う。API は `null` のまま返す。
- `generatedAt` はレスポンス生成時刻。ISO 8601 の UTC。

### 2.10 `generatedAt` と参考株価の鮮度

- `generatedAt` は「このレスポンスを生成した時刻」であり、データの更新時刻ではない。
- 参考株価の取得時刻は `quote.priceAt` に付ける。`priceAt` が `null` の場合は取得時刻不明として扱う。
- 株価は参考値であり、約定価格ではない。Muse は回答に `priceAt` と「参考値」であることを添える。
- 株価取得に失敗しても、保有情報は返す（現行画面と同じ）。失敗は `quote: null` と `quoteError` で表す（§4.2）。
- 株価のキャッシュはプロセス内で 5 分。`generatedAt` が新しくても `priceAt` が古いことがある。

### 2.11 並び順とページング

- ページングは提供しない。v1 のデータ量（単一ユーザー）を前提とする。
- 並び順は各エンドポイントに明記する。同じ値のときは `id` などの安定したキーで決める。
- 一覧の件数が将来問題になった時点で、別 Issue でページングを追加する。

## 3. データ型

以下はレスポンスに現れる型の定義である。

### 3.1 `Money`

```ts
type Money = {
  amount: number | null;
  currency: "JPY" | "USD" | null;
};
```

`currency` が `null` になるのは、通貨が不明な場合（手入力の売買、保有通貨の混在・過売却など。§2.8）。

### 3.2 `Stock`

```ts
type Stock = {
  id: string;
  ticker: string | null;
  name: string;
  market: string | null;
  marketCode: string | null;
  createdAt: string;
};
```

`market` / `marketCode` は既存データでは `"JP"` または `"US"`。手入力の銘柄では `null` がありうる。

### 3.3 `Decision`

```ts
type Decision = {
  id: string;
  stockId: string;
  type:
    | "buy"
    | "add"
    | "sell_consideration"
    | "sell"
    | "thesis_update"
    | "note";
  rawInput: string;
  transcript: string | null;
  followUpQuestion: string | null;
  followUpAnswer: string | null;
  summary: string | null;
  points: DecisionPoint[];
  thesis: string | null;
  assumptions: string[];
  reviewConditions: string[];
  addConditions: string[];
  reviewAt: string | null;
  reviewDates: string[];
  decidedAt: string | null;
  createdAt: string;
  origin: "web" | "muse";
};

type DecisionPoint = {
  kind:
    | "reason"
    | "expectation"
    | "assumption"
    | "observation"
    | "risk"
    | "uncertainty"
    | "condition"
    | "other";
  text: string;
  source: "raw_input" | "follow_up_answer";
};
```

- `type` の値は `src/schemas/decision.ts` の `DecisionTypeSchema` に一致する。
- `points` の `kind` / `source` も同スキーマに一致する。
- `summary` は保存値が `null` でも `thesis` があればそれを返す（`src/features/decisions/decision-mapper.ts`）。
- `reviewDates` は常に配列。`reviewAt` は `reviewDates` の先頭（既存データとの互換のため残す）。
- `decidedAt` は日付だけ。`null` は列追加前の既存データ。
- `origin` は R-02 で追加する。既存レコードは `"web"`。
- Web UI の編集履歴（`editHistory`）は API では返さない。窓口の対象は現在の記録だけとする。

### 3.4 `Transaction`

```ts
type Transaction = {
  id: string;
  stockId: string;
  side: "buy" | "sell";
  quantity: number;
  price: Money | null;
  fee: Money | null;
  executedAt: string;
  decisionId: string | null;
  createdAt: string;
  settlement: {
    date: string | null;
    amount: Money | null;
    exchangeRate: number | null;
  } | null;
  accountType: string | null;
  sourceBroker: "rakuten" | "sbi" | "nomura" | "monex" | null;
  sourceTradeType: string | null;
};
```

- `price` / `fee` は、元の列が `null` なら `null`。通貨は `priceCurrency` / `feeCurrency` を使う。
- `settlement` は、`settlementDate` / `settlementAmount` / `settlementCurrency` / `exchangeRate` がすべて `null` なら `null`。`amount` は `settlementAmount` と `settlementCurrency` をまとめたもの。
- `accountType` は自由文字列。CSV 取込では `"特定"`、`"一般"`、`"NISA"`、`"NISA 成長投資枠"`、`"NISA つみたて投資枠"`、`"NISA つみたて"` などになる。
- `sourceBroker` は CSV 取込の出所。手入力・API 由来では `null`。
- 取込の内部管理列（`importBatchId` / `sourceFingerprint` / `sourceRowNumber`）は API では返さない。

### 3.5 `Review`

```ts
type Review = {
  id: string;
  stockId: string;
  decisionId: string | null;
  currentInput: string;
  summary: string;
  differences: string[];
  reflection: string;
  createdAt: string;
  origin: "web" | "muse";
};
```

- `currentInput`: 振り返り時点の本人の考え（原文）。
- `summary` / `differences`: 過去との比較の要約・差分（派生データ）。
- `reflection`: 本人の振り返り本文。Muse が代筆しない。
- `origin` は R-02 で追加する。

### 3.6 `Capture`

```ts
type Capture = {
  id: string;
  stockId: string | null;
  stockHint: string | null;
  rawInput: string;
  origin: "web" | "muse";
  status: "pending" | "organized" | "discarded";
  decisionId: string | null;
  createdAt: string;
  organizedAt: string | null;
};
```

- `rawInput` は原文。保存時に書き換えない。
- `stockId` が `null` でも保存できる。`stockHint` は銘柄名の自由記述。
- `status` が `organized` のときだけ `decisionId` と `organizedAt` が入る。
- `discarded` の日時は保持しない（R-02 の `captures` に列を置かない）。

### 3.7 `Holding` / `ValuedHolding`

```ts
type Holding = {
  stockId: string;
  stockName: string;
  ticker: string | null;
  marketCode: string | null;
  quantity: number;
  averagePurchasePrice: Money | null;
  acquisitionAmount: Money | null;
  currency: "JPY" | "USD" | null;
  hasWarning: boolean;
  warningReason: string | null;
  adjustments: string[];
};

type Quote = {
  price: Money;
  priceAt: string | null;
  marketState: string | null;
  delayedByMinutes: number | null;
  sourceName: string | null;
};

type ValuedHolding = Holding & {
  quote: Quote | null;
  quoteError: string | null;
  marketValue: Money | null;
  unrealizedProfitLoss: Money | null;
  unrealizedProfitLossRate: number | null;
  realizedProfitLoss: Money | null;
};
```

- `Holding` は `calculatePortfolio` の戻り値に対応する。
- `ValuedHolding` は `calculateValuation` の戻り値に対応する。
- `averagePurchasePrice` / `acquisitionAmount` は、価格不明・通貨混在・過売却のとき `null`。
- `hasWarning` / `warningReason` は、過売却（`"売買履歴上、保有数量を超える売却があります"`）や通貨混在（`"異なる通貨の取引が混在しています"`）を表す。
- `adjustments` は株式分割・スピンオフの適用ラベル。
- `quote.price` は取得できたときだけ存在し、`amount` は正の数、`currency` は `"JPY"` か `"USD"`。
- `quoteError` は取得できなかった理由。正常時は `null`。
- `realizedProfitLoss` はその銘柄の実現損益合計。R-06 まで常に `null`。
- `quantity` は 0 でも `hasWarning` が true なら返ることがある（`calculatePortfolio` の仕様）。

### 3.8 列挙値の一覧

| フィールド                 | 値                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Decision.type`            | `buy` / `add` / `sell_consideration` / `sell` / `thesis_update` / `note`                                 |
| `DecisionPoint.kind`       | `reason` / `expectation` / `assumption` / `observation` / `risk` / `uncertainty` / `condition` / `other` |
| `DecisionPoint.source`     | `raw_input` / `follow_up_answer`                                                                         |
| `Transaction.side`         | `buy` / `sell`                                                                                           |
| `Transaction.sourceBroker` | `rakuten` / `sbi` / `nomura` / `monex` / `null`                                                          |
| `Capture.status`           | `pending` / `organized` / `discarded`                                                                    |
| `origin`                   | `web` / `muse`                                                                                           |
| `Money.currency`           | `JPY` / `USD` / `null`（通貨不明のとき）                                                                 |

## 4. 読み取りエンドポイント

読み取りはすべて `RULETRADE_READ_TOKEN` を要求する。書き込みトークンでは読めない（401）。レスポンスの各型は §3 を参照。

### 4.1 `GET /status`

疎通確認と台帳の現在状態の要約。実装 Issue: R-03。

- 認証: 読み取りトークン
- クエリ: なし
- リクエストボディ: なし

レスポンス `data`:

| フィールド               | 型               | 意味                                            |
| ------------------------ | ---------------- | ----------------------------------------------- |
| `apiVersion`             | `"v1"`           | 窓口 API の版                                   |
| `appVersion`             | `string`         | `package.json` の `version`（現在は `"0.1.0"`） |
| `counts.stocks`          | `number`         | 銘柄数                                          |
| `counts.decisions`       | `number`         | 判断数                                          |
| `counts.transactions`    | `number`         | 売買数                                          |
| `counts.reviews`         | `number`         | 振り返り数                                      |
| `counts.capturesPending` | `number`         | `status = "pending"` の受け箱件数               |
| `latest.stocks`          | `string \| null` | 銘柄の最新 `createdAt`                          |
| `latest.decisions`       | `string \| null` | 判断の最新 `createdAt`                          |
| `latest.transactions`    | `string \| null` | 売買の最新 `createdAt`                          |
| `latest.reviews`         | `string \| null` | 振り返りの最新 `createdAt`                      |
| `latest.captures`        | `string \| null` | 受け箱の最新 `createdAt`                        |

- `latest.*` はレコードの作成日時（`createdAt`）であり、判断日（`decidedAt`）や約定日（`executedAt`）ではない。
- テーブルが空の場合は `null`。
- `capturesPending` は R-07 の受け箱の未整理件数。R-02 で `captures` ができる前は 0 として扱う。

エラー:

| ステータス | code                     | 条件                                   |
| ---------- | ------------------------ | -------------------------------------- |
| 400        | `validation_error`       | 該当なし                               |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン |
| 404        | `not_found`              | 読み取りトークン未設定                 |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                   |

リクエスト例:

```http
GET /api/integration/v1/status HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "apiVersion": "v1",
    "appVersion": "0.1.0",
    "counts": {
      "stocks": 12,
      "decisions": 48,
      "transactions": 132,
      "reviews": 9,
      "capturesPending": 2
    },
    "latest": {
      "stocks": "2026-11-01T02:03:04.000Z",
      "decisions": "2026-11-07T12:45:00.000Z",
      "transactions": "2026-11-06T12:00:00.000Z",
      "reviews": "2026-11-08T08:09:10.000Z",
      "captures": "2026-11-07T11:12:13.000Z"
    }
  }
}
```

### 4.2 `GET /holdings`

保有銘柄ごとの数量・平均取得単価・取得額・参考株価・評価額・含み損益と、通貨別合計。実装 Issue: R-03（`realizedProfitLoss` は R-06）。

- 認証: 読み取りトークン
- クエリ: なし
- リクエストボディ: なし
- 並び順: `stockName` の昇順、同じなら `stockId` の昇順

レスポンス `data`:

| フィールド         | 型                 | 意味                                                         |
| ------------------ | ------------------ | ------------------------------------------------------------ |
| `holdings`         | `ValuedHolding[]`  | 保有銘柄。`calculatePortfolio` + `calculateValuation` の結果 |
| `totalsByCurrency` | `CurrencyTotals[]` | 通貨別合計。`"JPY"` と `"USD"` の 2 要素を常に返す           |

`CurrencyTotals`:

```ts
type CurrencyTotals = {
  currency: "JPY" | "USD";
  marketValue: Money | null;
  acquisitionAmount: Money | null;
  unrealizedProfitLoss: Money | null;
  unrealizedProfitLossRate: number | null;
  realizedProfitLoss: Money | null;
  completeness: {
    marketValue: boolean;
    acquisitionAmount: boolean;
    profitLoss: boolean;
    allocation: boolean;
  };
};
```

- 合計は既存の `summarizeValuation` と同じく、数量が 0 より大きい保有だけを対象にする。
- 一部の銘柄で株価や取得額が不明な場合、その通貨の該当する合計は `null` になり、`completeness` の該当フラグが `false` になる。一部だけの合計を返さない。
- `completeness.allocation` は、評価額が全銘柄分そろい、合計が 0 より大きいときだけ `true`。
- その通貨の保有が 1 件もない場合、`marketValue` / `acquisitionAmount` / `unrealizedProfitLoss` は 0 の `Money` になり、`completeness.allocation` は `false` になる（`summarizeValuation` の挙動）。
- `realizedProfitLoss` は R-06 まで `null`。R-06 で、各銘柄はその銘柄の実現損益合計、通貨別合計は通貨ごとの実現損益を入れる。

参考株価の扱い:

- `quote.priceAt` は株価の取得時刻（Yahoo Finance の `regularMarketTime`）。`null` なら時刻不明。
- `quote.marketState` / `quote.delayedByMinutes` / `quote.sourceName` は取得できたときだけ入る。
- 株価を取得できなくても `holdings` は返す。`quote: null` と `quoteError` で理由を表す。
- `quoteError` の値は現行画面と同じ:
  - `"市場価格を取得できる銘柄コードがありません"`（`ticker` / `marketCode` から銘柄コードを作れない）
  - `"市場価格を取得できませんでした"`（プロバイダが値を返さない）
  - `"保有通貨が不明なため評価損益を計算できません"`（`currency` が `null`）
  - `"通貨が一致しないため損益を計算できません"`（株価の通貨と保有通貨が違う）
- `quoteError` が `null` でも、`unrealizedProfitLoss` が `null` になる場合はある（取得通貨と保有通貨の不一致など）。評価できないかどうかは `marketValue` と `unrealizedProfitLoss` の両方で判定する。

エラー:

| ステータス | code                     | 条件                                   |
| ---------- | ------------------------ | -------------------------------------- |
| 400        | `validation_error`       | 該当なし                               |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン |
| 404        | `not_found`              | 読み取りトークン未設定                 |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                   |

リクエスト例:

```http
GET /api/integration/v1/holdings HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "holdings": [
      {
        "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
        "stockName": "キオクシア",
        "ticker": "285A",
        "marketCode": "JP",
        "quantity": 100,
        "averagePurchasePrice": { "amount": 2500, "currency": "JPY" },
        "acquisitionAmount": { "amount": 250000, "currency": "JPY" },
        "currency": "JPY",
        "hasWarning": false,
        "warningReason": null,
        "adjustments": [],
        "quote": {
          "price": { "amount": 2800, "currency": "JPY" },
          "priceAt": "2026-11-07T06:30:00.000Z",
          "marketState": "REGULAR",
          "delayedByMinutes": 20,
          "sourceName": "Yahoo Finance"
        },
        "quoteError": null,
        "marketValue": { "amount": 280000, "currency": "JPY" },
        "unrealizedProfitLoss": { "amount": 30000, "currency": "JPY" },
        "unrealizedProfitLossRate": 12,
        "realizedProfitLoss": null
      },
      {
        "stockId": "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        "stockName": "NVIDIA",
        "ticker": "NVDA",
        "marketCode": "US",
        "quantity": 10,
        "averagePurchasePrice": { "amount": 150, "currency": "USD" },
        "acquisitionAmount": { "amount": 1500, "currency": "USD" },
        "currency": "USD",
        "hasWarning": false,
        "warningReason": null,
        "adjustments": [],
        "quote": {
          "price": { "amount": 165, "currency": "USD" },
          "priceAt": "2026-11-07T06:30:00.000Z",
          "marketState": "REGULAR",
          "delayedByMinutes": 20,
          "sourceName": "Yahoo Finance"
        },
        "quoteError": null,
        "marketValue": { "amount": 1650, "currency": "USD" },
        "unrealizedProfitLoss": { "amount": 150, "currency": "USD" },
        "unrealizedProfitLossRate": 10,
        "realizedProfitLoss": null
      }
    ],
    "totalsByCurrency": [
      {
        "currency": "JPY",
        "marketValue": { "amount": 280000, "currency": "JPY" },
        "acquisitionAmount": { "amount": 250000, "currency": "JPY" },
        "unrealizedProfitLoss": { "amount": 30000, "currency": "JPY" },
        "unrealizedProfitLossRate": 12,
        "realizedProfitLoss": null,
        "completeness": {
          "marketValue": true,
          "acquisitionAmount": true,
          "profitLoss": true,
          "allocation": true
        }
      },
      {
        "currency": "USD",
        "marketValue": { "amount": 1650, "currency": "USD" },
        "acquisitionAmount": { "amount": 1500, "currency": "USD" },
        "unrealizedProfitLoss": { "amount": 150, "currency": "USD" },
        "unrealizedProfitLossRate": 10,
        "realizedProfitLoss": null,
        "completeness": {
          "marketValue": true,
          "acquisitionAmount": true,
          "profitLoss": true,
          "allocation": true
        }
      }
    ]
  }
}
```

参考株価の取得に失敗した保有の例（`holdings` の 1 要素）:

```json
{
  "stockId": "5b2c3d4e-6f70-4a1b-8c2d-3e4f5a6b7c8d",
  "stockName": "任天堂",
  "ticker": "7974",
  "marketCode": "JP",
  "quantity": 100,
  "averagePurchasePrice": { "amount": 8000, "currency": "JPY" },
  "acquisitionAmount": { "amount": 800000, "currency": "JPY" },
  "currency": "JPY",
  "hasWarning": false,
  "warningReason": null,
  "adjustments": [],
  "quote": null,
  "quoteError": "市場価格を取得できませんでした",
  "marketValue": null,
  "unrealizedProfitLoss": null,
  "unrealizedProfitLossRate": null,
  "realizedProfitLoss": null
}
```

### 4.3 `GET /stocks`

全銘柄の一覧。保有フラグ、判断の記録件数、最後に判断した日を付ける。実装 Issue: R-03。

- 認証: 読み取りトークン
- クエリ: なし
- リクエストボディ: なし
- 並び順: `name` の昇順、同じなら `id` の昇順

レスポンス `data`:

| フィールド | 型               | 意味   |
| ---------- | ---------------- | ------ |
| `stocks`   | `StockSummary[]` | 全銘柄 |

```ts
type StockSummary = Stock & {
  isHeld: boolean;
  decisionCount: number;
  lastDecidedOn: string | null;
};
```

- `isHeld` は `calculatePortfolio` の数量が 0 より大きいときに `true`。
- `decisionCount` は判断の件数。
- `lastDecidedOn` は最後の判断日（`decidedAt`、なければ `createdAt` を JST の日付にしたもの）。日付だけ。判断がなければ `null`。
- `lastDecidedOn` は「最後に判断した日」であり、最後にレコードを作成した日時ではない。日時が必要なら `GET /stocks/:id` の `timeline` にある判断の `createdAt` を使う。

エラー:

| ステータス | code                     | 条件                                   |
| ---------- | ------------------------ | -------------------------------------- |
| 400        | `validation_error`       | 該当なし                               |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン |
| 404        | `not_found`              | 読み取りトークン未設定                 |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                   |

リクエスト例:

```http
GET /api/integration/v1/stocks HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "stocks": [
      {
        "id": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
        "ticker": "285A",
        "name": "キオクシア",
        "market": "JP",
        "marketCode": "JP",
        "createdAt": "2026-01-02T03:04:05.000Z",
        "isHeld": true,
        "decisionCount": 4,
        "lastDecidedOn": "2026-11-07"
      },
      {
        "id": "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        "ticker": "NVDA",
        "name": "NVIDIA",
        "market": "US",
        "marketCode": "US",
        "createdAt": "2026-02-03T04:05:06.000Z",
        "isHeld": true,
        "decisionCount": 2,
        "lastDecidedOn": "2026-10-15"
      }
    ]
  }
}
```

### 4.4 `GET /stocks/:id`

銘柄詳細と、判断・売買・振り返りの時系列タイムライン。実装 Issue: R-03。

- 認証: 読み取りトークン
- パスパラメータ: `id`（銘柄 ID）
- クエリ: なし
- リクエストボディ: なし

レスポンス `data`:

| フィールド            | 型                | 意味                                                     |
| --------------------- | ----------------- | -------------------------------------------------------- |
| `stock`               | `Stock`           | 銘柄                                                     |
| `holding`             | `Holding \| null` | 保有情報。参考株価は含まない（必要なら `GET /holdings`） |
| `counts.decisions`    | `number`          | 判断の件数                                               |
| `counts.transactions` | `number`          | 売買の件数                                               |
| `counts.reviews`      | `number`          | 振り返りの件数                                           |
| `timeline`            | `TimelineItem[]`  | 判断・売買・振り返りを時系列に並べたもの                 |

```ts
type TimelineItem = {
  kind: "decision" | "transaction" | "review";
  occurredOn: string;
  occurredAt: string;
  decision?: Decision;
  transaction?: Transaction;
  review?: Review;
};
```

- `timeline` は `occurredOn`（JST の日付）の昇順、同じ日なら `occurredAt` の昇順。さらに同じなら `kind` の順（`decision` → `transaction` → `review`）と `id` で安定させる。
- `occurredOn` は、判断なら `decidedAt`（なければ `createdAt` の JST 日付）、売買なら `executedAt` の JST 日付、振り返りなら `createdAt` の JST 日付。
- `occurredAt` は、判断なら `createdAt`、売買なら `executedAt`、振り返りなら `createdAt`。
- `kind` に対応するフィールド（`decision` / `transaction` / `review`）が 1 つだけ入る。
- `holding` は `calculatePortfolio` の結果。数量が 0 で警告もなければ `null`。
- 銘柄が存在しない場合は 404。

エラー:

| ステータス | code                     | 条件                                           |
| ---------- | ------------------------ | ---------------------------------------------- |
| 400        | `validation_error`       | 該当なし                                       |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン         |
| 404        | `not_found`              | 読み取りトークン未設定、または銘柄が存在しない |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                           |

リクエスト例:

```http
GET /api/integration/v1/stocks/3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "stock": {
      "id": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
      "ticker": "285A",
      "name": "キオクシア",
      "market": "JP",
      "marketCode": "JP",
      "createdAt": "2026-01-02T03:04:05.000Z"
    },
    "holding": {
      "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
      "stockName": "キオクシア",
      "ticker": "285A",
      "marketCode": "JP",
      "quantity": 100,
      "averagePurchasePrice": { "amount": 2500, "currency": "JPY" },
      "acquisitionAmount": { "amount": 250000, "currency": "JPY" },
      "currency": "JPY",
      "hasWarning": false,
      "warningReason": null,
      "adjustments": []
    },
    "counts": {
      "decisions": 1,
      "transactions": 1,
      "reviews": 1
    },
    "timeline": [
      {
        "kind": "transaction",
        "occurredOn": "2026-11-07",
        "occurredAt": "2026-11-07T12:00:00.000Z",
        "transaction": {
          "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
          "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
          "side": "buy",
          "quantity": 100,
          "price": { "amount": 2500, "currency": "JPY" },
          "fee": { "amount": 550, "currency": "JPY" },
          "executedAt": "2026-11-07T12:00:00.000Z",
          "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "createdAt": "2026-11-07T12:05:00.000Z",
          "settlement": {
            "date": "2026-11-11T12:00:00.000Z",
            "amount": { "amount": 250550, "currency": "JPY" },
            "exchangeRate": null
          },
          "accountType": "特定",
          "sourceBroker": "sbi",
          "sourceTradeType": "現物買"
        }
      },
      {
        "kind": "decision",
        "occurredOn": "2026-11-07",
        "occurredAt": "2026-11-07T12:45:00.000Z",
        "decision": {
          "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
          "type": "buy",
          "rawInput": "AI向けNANDの需要がどこまで続くか見たい。",
          "transcript": null,
          "followUpQuestion": null,
          "followUpAnswer": null,
          "summary": "AI向けNAND需要の継続を期待して購入する。",
          "points": [
            {
              "kind": "reason",
              "text": "AI向けNANDの需要が伸びている",
              "source": "raw_input"
            }
          ],
          "thesis": "AI向けNAND需要の継続",
          "assumptions": ["データセンター向けの需要が続く"],
          "reviewConditions": ["NAND価格が2四半期連続で下落する"],
          "addConditions": ["決算で在庫回転が改善する"],
          "reviewAt": "2026-12-07T12:00:00.000Z",
          "reviewDates": ["2026-12-07T12:00:00.000Z"],
          "decidedAt": "2026-11-07",
          "createdAt": "2026-11-07T12:45:00.000Z",
          "origin": "muse"
        }
      },
      {
        "kind": "review",
        "occurredOn": "2026-11-08",
        "occurredAt": "2026-11-08T08:09:10.000Z",
        "review": {
          "id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
          "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
          "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "currentInput": "NAND価格は下がっているが、AI向けの需要は続いている。",
          "summary": "前回の判断から、需要の見方は変わっていない。",
          "differences": ["在庫回転の見方だけが変わった"],
          "reflection": "需要の見方は変わっていないが、在庫を確認する頻度を上げる。",
          "createdAt": "2026-11-08T08:09:10.000Z",
          "origin": "web"
        }
      }
    ]
  }
}
```

### 4.5 `GET /transactions`

売買履歴の絞り込み取得。実装 Issue: R-03。

- 認証: 読み取りトークン
- クエリ:

| パラメータ | 型                | 必須 | 意味                                     |
| ---------- | ----------------- | ---- | ---------------------------------------- |
| `stockId`  | `string`          | 任意 | 銘柄 ID で絞り込む。存在しない ID は 404 |
| `side`     | `"buy" \| "sell"` | 任意 | 売買区分で絞り込む                       |
| `from`     | `YYYY-MM-DD`      | 任意 | 約定日の開始（JST の暦日、この日を含む） |
| `to`       | `YYYY-MM-DD`      | 任意 | 約定日の終了（JST の暦日、この日を含む） |

- `from` / `to` は `executedAt` を JST に変換した暦日で比較する。`from` はその日の `00:00:00+09:00` 以降、`to` はその日の `23:59:59.999+09:00` 以前。
- `from` > `to` は 400。
- 並び順: `executedAt` の降順、同じなら `createdAt` の降順、さらに `id` の昇順。
- ページングはない。全件を返す。

レスポンス `data`:

| フィールド     | 型              | 意味     |
| -------------- | --------------- | -------- |
| `transactions` | `Transaction[]` | 売買履歴 |

エラー:

| ステータス | code                     | 条件                                                     |
| ---------- | ------------------------ | -------------------------------------------------------- |
| 400        | `validation_error`       | `side` が不正、`from` / `to` が日付でない、`from` > `to` |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン                   |
| 404        | `not_found`              | 読み取りトークン未設定、または `stockId` の銘柄がない    |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                                     |

リクエスト例:

```http
GET /api/integration/v1/transactions?stockId=3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f&side=buy&from=2026-11-01&to=2026-11-30 HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "transactions": [
      {
        "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
        "side": "buy",
        "quantity": 100,
        "price": { "amount": 2500, "currency": "JPY" },
        "fee": { "amount": 550, "currency": "JPY" },
        "executedAt": "2026-11-07T12:00:00.000Z",
        "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "createdAt": "2026-11-07T12:05:00.000Z",
        "settlement": {
          "date": "2026-11-11T12:00:00.000Z",
          "amount": { "amount": 250550, "currency": "JPY" },
          "exchangeRate": null
        },
        "accountType": "特定",
        "sourceBroker": "sbi",
        "sourceTradeType": "現物買"
      }
    ]
  }
}
```

### 4.6 `GET /due`

振り返り期限が到来した判断と、理由が残っていない売買。実装 Issue: R-04。

- 認証: 読み取りトークン
- クエリ: なし
- リクエストボディ: なし

判定ルール（現行の「今日」画面と同じ。R-04 で共通部品化する）:

- 対象は `reviewAt` が設定された判断（`reviewAt` は `reviewDates` の先頭）。
- その判断に紐付く振り返りの最新 `createdAt` より後に到来した `reviewDates` のうち、現在時刻以前の最も早い日を `dueReviewAt` とする。
- 振り返りが 1 件もない場合は、現在時刻以前の最も早い `reviewDates` を `dueReviewAt` とする。
- 同じ判断に複数の期限がある場合、API は最も早い 1 件だけを返す（現行コードの `.sort()[0]` と同じ）。
- 理由が残っていない売買は、`decisionId` が `null` の売買すべて。画面は先頭 3 件に絞るが、API は全件返す。
- 期限の判定はサーバーの現在時刻で行う。`asOf` にその時刻を入れる。

レスポンス `data`:

| フィールド             | 型                 | 意味                                 |
| ---------------------- | ------------------ | ------------------------------------ |
| `asOf`                 | `string`           | 判定に使った現在時刻（ISO 8601 UTC） |
| `dueDecisions`         | `DueDecision[]`    | 期限が到来した判断                   |
| `unlinkedTransactions` | `DueTransaction[]` | 理由が残っていない売買               |

```ts
type DueDecision = {
  stock: Stock;
  decision: Decision;
  dueReviewAt: string;
  dueOn: string;
};

type DueTransaction = {
  stock: Stock;
  transaction: Transaction;
};
```

- `dueDecisions` は `dueReviewAt` の昇順。
- `unlinkedTransactions` は `executedAt` の降順。
- `decision.reviewAt` は元の値のまま。期限として採用した日は `dueReviewAt` で返す。
- `dueOn` は `dueReviewAt` の JST の日付。

エラー:

| ステータス | code                     | 条件                                   |
| ---------- | ------------------------ | -------------------------------------- |
| 400        | `validation_error`       | 該当なし                               |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン |
| 404        | `not_found`              | 読み取りトークン未設定                 |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                   |

リクエスト例:

```http
GET /api/integration/v1/due HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "asOf": "2026-11-07T12:34:56.789Z",
    "dueDecisions": [
      {
        "stock": {
          "id": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
          "ticker": "285A",
          "name": "キオクシア",
          "market": "JP",
          "marketCode": "JP",
          "createdAt": "2026-01-02T03:04:05.000Z"
        },
        "decision": {
          "id": "e6f7a8b9-c0d1-4e2f-9a3b-4c5d6e7f8091",
          "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
          "type": "buy",
          "rawInput": "AI向けNANDの需要がどこまで続くか見たい。",
          "transcript": null,
          "followUpQuestion": null,
          "followUpAnswer": null,
          "summary": "AI向けNAND需要の継続を期待して購入する。",
          "points": [],
          "thesis": "AI向けNAND需要の継続",
          "assumptions": ["データセンター向けの需要が続く"],
          "reviewConditions": ["NAND価格が2四半期連続で下落する"],
          "addConditions": [],
          "reviewAt": "2026-11-01T12:00:00.000Z",
          "reviewDates": ["2026-11-01T12:00:00.000Z"],
          "decidedAt": "2026-10-01",
          "createdAt": "2026-10-01T10:00:00.000Z",
          "origin": "web"
        },
        "dueReviewAt": "2026-11-01T12:00:00.000Z",
        "dueOn": "2026-11-01"
      }
    ],
    "unlinkedTransactions": [
      {
        "stock": {
          "id": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
          "ticker": "285A",
          "name": "キオクシア",
          "market": "JP",
          "marketCode": "JP",
          "createdAt": "2026-01-02T03:04:05.000Z"
        },
        "transaction": {
          "id": "f7a8b9c0-d1e2-4f3a-8b4c-5d6e7f8091a2",
          "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
          "side": "sell",
          "quantity": 50,
          "price": { "amount": 2800, "currency": "JPY" },
          "fee": null,
          "executedAt": "2026-11-06T12:00:00.000Z",
          "decisionId": null,
          "createdAt": "2026-11-06T12:05:00.000Z",
          "settlement": {
            "date": "2026-11-10T12:00:00.000Z",
            "amount": { "amount": 140000, "currency": "JPY" },
            "exchangeRate": null
          },
          "accountType": "特定",
          "sourceBroker": "sbi",
          "sourceTradeType": "現物売"
        }
      }
    ]
  }
}
```

### 4.7 `GET /captures`

受け箱の一覧。実装 Issue: R-07。

- 認証: 読み取りトークン
- クエリ:

| パラメータ | 型                                            | 必須 | 意味                                             |
| ---------- | --------------------------------------------- | ---- | ------------------------------------------------ |
| `status`   | `pending` / `organized` / `discarded` / `all` | 任意 | 状態で絞り込む。省略時は `pending`（未整理だけ） |

- `status` の既定は `pending`。Muse の定期確認が「未整理の受け箱」を既定で読めるようにするため。
- `status=all` はすべての状態を返す。
- 並び順: `createdAt` の昇順、同じなら `id` の昇順。古い受け箱から処理する。
- ページングはない。

レスポンス `data`:

| フィールド | 型          | 意味   |
| ---------- | ----------- | ------ |
| `captures` | `Capture[]` | 受け箱 |

エラー:

| ステータス | code                     | 条件                                   |
| ---------- | ------------------------ | -------------------------------------- |
| 400        | `validation_error`       | `status` が上記の値以外                |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン |
| 404        | `not_found`              | 読み取りトークン未設定                 |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                   |

リクエスト例:

```http
GET /api/integration/v1/captures?status=pending HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "captures": [
      {
        "id": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
        "stockId": null,
        "stockHint": "キオクシア",
        "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
        "origin": "muse",
        "status": "pending",
        "decisionId": null,
        "createdAt": "2026-11-07T11:12:13.000Z",
        "organizedAt": null
      }
    ]
  }
}
```

### 4.8 `GET /realized-pnl`

実現損益を売却レコード単位で返す。実装 Issue: R-06。

- 認証: 読み取りトークン
- クエリ:

| パラメータ | 型           | 必須 | 意味                                     |
| ---------- | ------------ | ---- | ---------------------------------------- |
| `from`     | `YYYY-MM-DD` | 任意 | 売却日の開始（JST の暦日、この日を含む） |
| `to`       | `YYYY-MM-DD` | 任意 | 売却日の終了（JST の暦日、この日を含む） |
| `stockId`  | `string`     | 任意 | 銘柄 ID で絞り込む。存在しない ID は 404 |

- 対象は `side = "sell"` の売買。`from` / `to` は `executedAt` の JST の暦日で比較する。
- `from` > `to` は 400。省略時は全期間。
- 並び順: `executedAt` の昇順、同じなら `id` の昇順（損益の確定順）。
- `totalsByCurrency` は、売却が 1 件以上ある通貨だけを返す。通貨を跨いだ合計は返さない。

計算ルール:

> R-06 着手時に `calculatePortfolio` の実装（平均取得単価法、手数料の扱い、株式分割の適用日）に揃えて確定し、この文書を更新する。R-01 ではレスポンスの形だけを固定し、計算結果の値を断定しない。

- 現時点の `calculatePortfolio` は、買いの平均取得単価に `price` だけを使い、`fee` を取得額に含めていない（`src/features/portfolio/portfolio.ts`）。R-06 はこの扱いを確認したうえで、手数料を実現損益にどう反映するかを決める。
- 株式分割・スピンオフは `src/features/portfolio/corporate-actions.ts` の適用日ルールで売買の再生に織り込む。
- 円とドルの換算・合算はしない。

レスポンス `data`:

| フィールド         | 型                 | 意味                           |
| ------------------ | ------------------ | ------------------------------ |
| `sales`            | `RealizedSale[]`   | 売却レコード単位の実現損益     |
| `totalsByCurrency` | `RealizedTotals[]` | 通貨別合計。売却がある通貨だけ |

```ts
type RealizedSale = {
  transactionId: string;
  stockId: string;
  stockName: string;
  ticker: string | null;
  side: "sell";
  quantity: number;
  executedAt: string;
  currency: "JPY" | "USD" | null;
  proceeds: Money | null;
  costBasis: Money | null;
  fee: Money | null;
  realizedProfitLoss: Money | null;
  decisionId: string | null;
};

type RealizedTotals = {
  currency: "JPY" | "USD";
  saleCount: number;
  proceeds: Money | null;
  costBasis: Money | null;
  realizedProfitLoss: Money | null;
  completeness: boolean;
};
```

- `proceeds`: 売却代金（`price × quantity`）。価格不明なら `null`。
- `costBasis`: 売却時点の平均取得単価 × 数量。取得単価不明なら `null`。
- `fee`: 売買の手数料。未入力なら `null`。
- `realizedProfitLoss`: `proceeds - costBasis` を基本とし、手数料の扱いは R-06 で確定する。不明なら `null`。
- `completeness`: その通貨の全売却で `realizedProfitLoss` が `null` でないときだけ `true`。
- 全売却済みの銘柄は `GET /holdings` に出ないため、実現損益はこの専用エンドポイントで読む。

エラー:

| ステータス | code                     | 条件                                                  |
| ---------- | ------------------------ | ----------------------------------------------------- |
| 400        | `validation_error`       | `from` / `to` が日付でない、`from` > `to`             |
| 401        | `unauthorized`           | トークンなし・不一致・書き込みトークン                |
| 404        | `not_found`              | 読み取りトークン未設定、または `stockId` の銘柄がない |
| 409        | `idempotency_key_reused` | 該当なし（読み取り）                                  |

リクエスト例:

```http
GET /api/integration/v1/realized-pnl?from=2026-11-01&to=2026-11-30 HTTP/1.1
Authorization: Bearer <RULETRADE_READ_TOKEN>
```

レスポンス例（手数料が未入力の売却。計算ルールは R-06 で確定する）:

```json
{
  "generatedAt": "2026-11-07T12:34:56.789Z",
  "data": {
    "sales": [
      {
        "transactionId": "f7a8b9c0-d1e2-4f3a-8b4c-5d6e7f8091a2",
        "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
        "stockName": "キオクシア",
        "ticker": "285A",
        "side": "sell",
        "quantity": 50,
        "executedAt": "2026-11-06T12:00:00.000Z",
        "currency": "JPY",
        "proceeds": { "amount": 140000, "currency": "JPY" },
        "costBasis": { "amount": 125000, "currency": "JPY" },
        "fee": null,
        "realizedProfitLoss": { "amount": 15000, "currency": "JPY" },
        "decisionId": null
      }
    ],
    "totalsByCurrency": [
      {
        "currency": "JPY",
        "saleCount": 1,
        "proceeds": { "amount": 140000, "currency": "JPY" },
        "costBasis": { "amount": 125000, "currency": "JPY" },
        "realizedProfitLoss": { "amount": 15000, "currency": "JPY" },
        "completeness": true
      }
    ]
  }
}
```

## 5. 書き込みエンドポイント

書き込みはすべて `RULETRADE_WRITE_TOKEN` を要求する。読み取りトークンでは書けない（401）。すべて「確認済みの確定書き込み」専用で、下書き状態を持たない。レスポンスの各型は §3 を参照。

### 5.1 冪等ルール（`clientRequestId`）

書き込みのすべてに `clientRequestId`（UUID 文字列）を必須で付ける。同じキーの再送で二重登録しない。

- `clientRequestId` は RFC 4122 の UUID 形式（`8-4-4-4-12` の 16 進数）。大文字小文字は区別しない。バージョンは問わない（v4 を推奨）。
- 欠落・UUID 形式でない・空文字は 400 `validation_error`。
- キーは全書き込みエンドポイントで共通の名前空間を持ち、全体で一意。同じキーを別のエンドポイントで使うと 409。
- キーの管理は専用テーブル `integration_requests` で行う（R-02 で作成）。`decisions` / `reviews` / `captures` の各テーブルに列を足さない。`decision-link` や「`captureId` 指定で受け箱を整理済みにする」は新しい行を作らないため、リソース側の列では冪等を表せないからである。

`integration_requests` の列（例）:

| 列                  | 型     | 意味                                                                                    |
| ------------------- | ------ | --------------------------------------------------------------------------------------- |
| `client_request_id` | `TEXT` | 主キー。`clientRequestId`                                                               |
| `endpoint`          | `TEXT` | メソッド + 実際のパス（例: `POST /decisions`、`POST /transactions/<id>/decision-link`） |
| `request_hash`      | `TEXT` | リクエスト本文の正規化 JSON の SHA-256                                                  |
| `resource_type`     | `TEXT` | `capture` / `decision` / `transaction` / `review`                                       |
| `resource_id`       | `TEXT` | 作成または更新したリソースの ID                                                         |
| `created_at`        | `TEXT` | キーを記録した時刻（ISO 8601 UTC）                                                      |

リクエスト本文のハッシュ:

- `clientRequestId` を除いた本文を JSON として再帰的にキー順でソートし、SHA-256 を取る。
- 省略された任意フィールドは、配列は `[]`、それ以外は `null` で補完してから計算する。
- ハッシュは受け取った本文の値のまま計算する（検証で trim するフィールドも、ハッシュ計算時は受け取った値を使う）。

振る舞い:

| 状況                                         | 書き込み | HTTP                          | `data.replayed` |
| -------------------------------------------- | -------- | ----------------------------- | --------------- |
| 初回成功                                     | する     | 201（`decision-link` は 200） | `false`         |
| 同じキー・同じエンドポイント・同じ本文の再送 | しない   | 200                           | `true`          |
| 同じキーで本文が違う                         | しない   | 409 `idempotency_key_reused`  | なし            |
| 同じキーでエンドポイントが違う               | しない   | 409 `idempotency_key_reused`  | なし            |

- 再送時は何も書かず、初回に作成・更新したリソースを「現在の状態」で返す。初回のレスポンスをそのままキャッシュして返すのではない。
- 再送のレスポンスにも `generatedAt` を付ける（現在時刻）。
- 失敗したリクエスト（400 / 401 / 404 / 409 / 500）はキーを記録しない。同じキーで修正して再送できる。
- 書き込みとキー記録は 1 トランザクションで行う。検証エラーや途中の失敗で部分書き込みを残さない。
- 同時に同じキーが来た場合、SQLite の主キー制約で片方だけが成功する。負けた側はコミット済みの行を読み、本文とエンドポイントが同じなら 200 の再送、違えば 409 を返す。
- 再送の判定に使う「同じ本文」は、上記の正規化後のハッシュで比較する。
- `decision-link` の再送で `decision` を返すときは、売買の現在の `decisionId` に対応する判断を返す（再送後に別の判断へ差し替えられていれば、その現在の判断）。
- `decision-link` の再送では何も変更しないため、`previousDecisionId` は `null` を返す（初回にどの判断から差し替えたかは保存しない）。

初回成功のステータス:

- `POST /captures` / `POST /decisions` / `POST /reviews` は 201。
- `POST /transactions/:id/decision-link` は新しい行を作らないため 200。更新系で 201 を返すと「リソースが増えた」と誤読されるため。

### 5.2 `POST /captures`

原文をそのまま受け箱へ追加する。実装 Issue: R-07。

- 認証: 書き込みトークン
- リクエストボディ:

| フィールド        | 型               | 必須 | 意味                                               |
| ----------------- | ---------------- | ---- | -------------------------------------------------- |
| `clientRequestId` | `string`         | 必須 | 冪等キー（UUID）                                   |
| `rawInput`        | `string`         | 必須 | 原文。空文字・空白だけは不可。保存時に trim しない |
| `stockId`         | `string \| null` | 任意 | 銘柄 ID。既存の銘柄だけ。省略・`null` なら銘柄未定 |
| `stockHint`       | `string \| null` | 任意 | 銘柄名の自由記述。銘柄未定のまま保存できる         |

- `origin` / `status` / `decisionId` / `organizedAt` はリクエストで指定しない。サーバーが `origin = "muse"`、`status = "pending"`、`decisionId = null`、`organizedAt = null` を設定する。
- 振り返り日は保存時に付けない（設計メモ §11 U5）。整理時に `POST /decisions` で付ける。
- `stockId` が存在しない場合は 404。
- `stockId` と `stockHint` は両方 `null` でもよい。
- 成功時は 201。

レスポンス `data`:

| フィールド | 型        | 意味                   |
| ---------- | --------- | ---------------------- |
| `replayed` | `boolean` | 再送なら `true`        |
| `capture`  | `Capture` | 作成した受け箱エントリ |

エラー:

| ステータス | code                     | 条件                                                        |
| ---------- | ------------------------ | ----------------------------------------------------------- |
| 400        | `validation_error`       | `clientRequestId` が UUID でない、`rawInput` が空、型が違う |
| 401        | `unauthorized`           | トークンなし・不一致・読み取りトークン                      |
| 404        | `not_found`              | 書き込みトークン未設定、または `stockId` の銘柄がない       |
| 409        | `idempotency_key_reused` | 同じキーを別の本文・エンドポイントで使った                  |

リクエスト例:

```http
POST /api/integration/v1/captures HTTP/1.1
Authorization: Bearer <RULETRADE_WRITE_TOKEN>
Content-Type: application/json; charset=utf-8
```

```json
{
  "clientRequestId": "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081",
  "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
  "stockId": null,
  "stockHint": "キオクシア"
}
```

レスポンス例（201）:

```json
{
  "generatedAt": "2026-11-07T12:40:00.000Z",
  "data": {
    "replayed": false,
    "capture": {
      "id": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
      "stockId": null,
      "stockHint": "キオクシア",
      "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
      "origin": "muse",
      "status": "pending",
      "decisionId": null,
      "createdAt": "2026-11-07T12:40:00.000Z",
      "organizedAt": null
    }
  }
}
```

同じキー・同じ本文の再送（200）:

```json
{
  "generatedAt": "2026-11-07T12:41:00.000Z",
  "data": {
    "replayed": true,
    "capture": {
      "id": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
      "stockId": null,
      "stockHint": "キオクシア",
      "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
      "origin": "muse",
      "status": "pending",
      "decisionId": null,
      "createdAt": "2026-11-07T12:40:00.000Z",
      "organizedAt": null
    }
  }
}
```

同じキーを別の本文で使った場合（409）:

```json
{
  "error": {
    "code": "idempotency_key_reused",
    "message": "同じ clientRequestId が別のリクエストで使用されています。"
  }
}
```

### 5.3 `POST /decisions`

整理済みの判断を新規登録する。実装 Issue: R-08。

- 認証: 書き込みトークン
- リクエストボディ:

| フィールド         | 型                | 必須 | 意味                                                                     |
| ------------------ | ----------------- | ---- | ------------------------------------------------------------------------ |
| `clientRequestId`  | `string`          | 必須 | 冪等キー（UUID）                                                         |
| `stockId`          | `string`          | 必須 | 既存の銘柄 ID。存在しなければ 404                                        |
| `type`             | `string`          | 必須 | `buy` / `add` / `sell_consideration` / `sell` / `thesis_update` / `note` |
| `rawInput`         | `string`          | 必須 | 原文。空文字・空白だけは不可。保存時に trim しない                       |
| `decidedAt`        | `YYYY-MM-DD`      | 任意 | 判断日。省略時はリクエスト時刻の JST の日付                              |
| `summary`          | `string \| null`  | 任意 | 要約。省略時は `thesis`、両方なければ `null`                             |
| `points`           | `DecisionPoint[]` | 任意 | 原文から整理した点。省略時は `[]`                                        |
| `thesis`           | `string \| null`  | 任意 | 投資仮説                                                                 |
| `assumptions`      | `string[]`        | 任意 | 前提。省略時は `[]`                                                      |
| `reviewConditions` | `string[]`        | 任意 | 見直し条件。省略時は `[]`                                                |
| `addConditions`    | `string[]`        | 任意 | 買い増し条件。省略時は `[]`                                              |
| `reviewDates`      | `string[]`        | 任意 | 振り返り日（ISO 8601 の日時）。省略時は `[]`                             |
| `captureId`        | `string \| null`  | 任意 | 整理元の受け箱 ID。指定時は同じトランザクションで整理済みにする          |

- `origin` はサーバーが `"muse"` を記録する。リクエストでは指定しない。
- 売買は作成しない。既存の売買への自動紐付けもしない。紐付けは `POST /transactions/:id/decision-link` で別途行う（既存画面の「候補が 1 件なら自動で紐付ける」挙動は API では行わない）。
- `reviewDates` はサーバーで重複排除し、昇順に並べる。`reviewAt` はその先頭。`reviewDates` が空なら `reviewAt` は `null`。
- `summary` は `summary ?? thesis ?? null` を保存する（既存の `saveDecisionAction` と同じ）。
- `points` / `assumptions` / `reviewConditions` / `addConditions` は省略時に `[]`。
- `decidedAt` を省略した場合は「今日」になる。受け箱の記録日を判断日にしたい場合は、Muse が `capture.createdAt` の JST 日付を明示して送る。

`captureId` の扱い:

- 受け箱が存在しない場合は 404。
- 受け箱が `pending` でない（`organized` / `discarded`）場合は 409 `capture_not_pending`。
- 受け箱の `stockId` が `null` なら、リクエストの `stockId` を判断に使う。受け箱の `stockId` 列は変更しない。
- 受け箱の `stockId` が存在し、リクエストの `stockId` と違う場合は 400 `validation_error`（同じ銘柄を指定する）。
- 成功時は同じトランザクションで、受け箱の `status = "organized"`、`decisionId = 作成した判断 ID`、`organizedAt = 現在時刻` にする。
- `capture.origin` は受け箱を作成した経路のまま（Web 由来なら `"web"`、API 由来なら `"muse"`）。判断の `origin` は `"muse"`。
- 判断の作成と受け箱の更新は 1 トランザクション。どちらかが失敗したら両方ロールバックする。
- 成功時は 201。

レスポンス `data`:

| フィールド | 型                | 意味                                        |
| ---------- | ----------------- | ------------------------------------------- |
| `replayed` | `boolean`         | 再送なら `true`                             |
| `decision` | `Decision`        | 作成した判断                                |
| `capture`  | `Capture \| null` | 整理した受け箱。`captureId` なしなら `null` |

エラー:

| ステータス | code                     | 条件                                                                                                                    |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 400        | `validation_error`       | UUID 不正、必須欠落、`type` 不正、`decidedAt` が日付でない、`reviewDates` が日時でない、受け箱の銘柄と `stockId` が違う |
| 401        | `unauthorized`           | トークンなし・不一致・読み取りトークン                                                                                  |
| 404        | `not_found`              | 書き込みトークン未設定、`stockId` の銘柄がない、`captureId` の受け箱がない                                              |
| 409        | `capture_not_pending`    | 受け箱が `organized` / `discarded` 済み                                                                                 |
| 409        | `idempotency_key_reused` | 同じキーを別の本文・エンドポイントで使った                                                                              |

リクエスト例:

```http
POST /api/integration/v1/decisions HTTP/1.1
Authorization: Bearer <RULETRADE_WRITE_TOKEN>
Content-Type: application/json; charset=utf-8
```

```json
{
  "clientRequestId": "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f708192",
  "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
  "captureId": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
  "type": "buy",
  "decidedAt": "2026-11-07",
  "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
  "summary": "AI向けNAND需要の継続を期待して購入する。",
  "points": [
    {
      "kind": "reason",
      "text": "AI向けNANDの需要が伸びている",
      "source": "raw_input"
    }
  ],
  "thesis": "AI向けNAND需要の継続",
  "assumptions": ["データセンター向けの需要が続く"],
  "reviewConditions": ["NAND価格が2四半期連続で下落する"],
  "addConditions": ["決算で在庫回転が改善する"],
  "reviewDates": ["2026-12-07T12:00:00.000Z"]
}
```

レスポンス例（201）:

```json
{
  "generatedAt": "2026-11-07T12:45:00.000Z",
  "data": {
    "replayed": false,
    "decision": {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
      "type": "buy",
      "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
      "transcript": null,
      "followUpQuestion": null,
      "followUpAnswer": null,
      "summary": "AI向けNAND需要の継続を期待して購入する。",
      "points": [
        {
          "kind": "reason",
          "text": "AI向けNANDの需要が伸びている",
          "source": "raw_input"
        }
      ],
      "thesis": "AI向けNAND需要の継続",
      "assumptions": ["データセンター向けの需要が続く"],
      "reviewConditions": ["NAND価格が2四半期連続で下落する"],
      "addConditions": ["決算で在庫回転が改善する"],
      "reviewAt": "2026-12-07T12:00:00.000Z",
      "reviewDates": ["2026-12-07T12:00:00.000Z"],
      "decidedAt": "2026-11-07",
      "createdAt": "2026-11-07T12:45:00.000Z",
      "origin": "muse"
    },
    "capture": {
      "id": "d4e5f6a7-b8c9-4d0e-9f1a-2b3c4d5e6f70",
      "stockId": null,
      "stockHint": "キオクシア",
      "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
      "origin": "muse",
      "status": "organized",
      "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "createdAt": "2026-11-07T12:40:00.000Z",
      "organizedAt": "2026-11-07T12:45:00.000Z"
    }
  }
}
```

再送時は `data.replayed` が `true` になり、`decision` と `capture` は現在の状態で返る（HTTP 200）。

### 5.4 `POST /transactions/:id/decision-link`

売買へ判断記録を紐付ける（「理由を残す」の外部版）。実装 Issue: R-08。

- 認証: 書き込みトークン
- パスパラメータ: `id`（売買 ID）
- リクエストボディ:

| フィールド        | 型       | 必須 | 意味                                   |
| ----------------- | -------- | ---- | -------------------------------------- |
| `clientRequestId` | `string` | 必須 | 冪等キー（UUID）                       |
| `decisionId`      | `string` | 必須 | 紐付ける判断 ID。`null` は受け付けない |

- 売買が存在しない場合は 404。
- 判断が存在しない場合は 404。
- 判断の `stockId` と売買の `stockId` が違う場合は 400 `validation_error`。
- 既に別の判断に紐付いている場合の差し替えは可（設計メモ §5.4）。レスポンスの `previousDecisionId` に差し替え前の判断 ID を返す。
- 既に同じ判断に紐付いている場合は変更なしで 200。`previousDecisionId` は同じ判断 ID。
- 紐付けの解除（`decisionId = null`）は API に持たせない。解除は Web UI の操作に残す。
- 売買・判断の `origin` は変更しない。
- 成功時は 200（新しい行を作らないため。§5.1）。

レスポンス `data`:

| フィールド           | 型               | 意味                                                                |
| -------------------- | ---------------- | ------------------------------------------------------------------- |
| `replayed`           | `boolean`        | 再送なら `true`                                                     |
| `transaction`        | `Transaction`    | 紐付け後の売買                                                      |
| `decision`           | `Decision`       | 紐付けた判断                                                        |
| `previousDecisionId` | `string \| null` | 差し替え前の判断 ID。初回に紐付けがなければ `null`。再送時も `null` |

エラー:

| ステータス | code                     | 条件                                             |
| ---------- | ------------------------ | ------------------------------------------------ |
| 400        | `validation_error`       | UUID 不正、`decisionId` が空・`null`、銘柄が違う |
| 401        | `unauthorized`           | トークンなし・不一致・読み取りトークン           |
| 404        | `not_found`              | 書き込みトークン未設定、売買がない、判断がない   |
| 409        | `idempotency_key_reused` | 同じキーを別の本文・エンドポイントで使った       |

リクエスト例:

```http
POST /api/integration/v1/transactions/d9e0f1a2-b3c4-4d5e-8f6a-7b8c9d0e1f2a/decision-link HTTP/1.1
Authorization: Bearer <RULETRADE_WRITE_TOKEN>
Content-Type: application/json; charset=utf-8
```

```json
{
  "clientRequestId": "a7b8c9d0-e1f2-4a3b-9c4d-5e6f708192a3",
  "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
}
```

レスポンス例（200）:

```json
{
  "generatedAt": "2026-11-07T12:50:00.000Z",
  "data": {
    "replayed": false,
    "transaction": {
      "id": "d9e0f1a2-b3c4-4d5e-8f6a-7b8c9d0e1f2a",
      "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
      "side": "buy",
      "quantity": 100,
      "price": { "amount": 2500, "currency": "JPY" },
      "fee": { "amount": 550, "currency": "JPY" },
      "executedAt": "2026-11-07T12:00:00.000Z",
      "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "createdAt": "2026-11-07T12:05:00.000Z",
      "settlement": {
        "date": "2026-11-11T12:00:00.000Z",
        "amount": { "amount": 250550, "currency": "JPY" },
        "exchangeRate": null
      },
      "accountType": "特定",
      "sourceBroker": "sbi",
      "sourceTradeType": "現物買"
    },
    "decision": {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
      "type": "buy",
      "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
      "transcript": null,
      "followUpQuestion": null,
      "followUpAnswer": null,
      "summary": "AI向けNAND需要の継続を期待して購入する。",
      "points": [],
      "thesis": "AI向けNAND需要の継続",
      "assumptions": ["データセンター向けの需要が続く"],
      "reviewConditions": ["NAND価格が2四半期連続で下落する"],
      "addConditions": ["決算で在庫回転が改善する"],
      "reviewAt": "2026-12-07T12:00:00.000Z",
      "reviewDates": ["2026-12-07T12:00:00.000Z"],
      "decidedAt": "2026-11-07",
      "createdAt": "2026-11-07T12:45:00.000Z",
      "origin": "muse"
    },
    "previousDecisionId": null
  }
}
```

### 5.5 `POST /reviews`

振り返りを新規登録する。実装 Issue: R-08。

- 認証: 書き込みトークン
- リクエストボディ:

| フィールド        | 型               | 必須 | 意味                                                   |
| ----------------- | ---------------- | ---- | ------------------------------------------------------ |
| `clientRequestId` | `string`         | 必須 | 冪等キー（UUID）                                       |
| `stockId`         | `string`         | 必須 | 既存の銘柄 ID。存在しなければ 404                      |
| `decisionId`      | `string \| null` | 任意 | 比較対象の判断 ID。省略・`null` なら銘柄だけに紐付ける |
| `currentInput`    | `string`         | 必須 | 振り返り時点の本人の考え（原文）。空文字は不可         |
| `summary`         | `string`         | 必須 | 過去との比較の要約。空文字は不可                       |
| `differences`     | `string[]`       | 必須 | 過去との差分。空配列は可                               |
| `reflection`      | `string`         | 必須 | 本人の振り返り本文。空文字は不可                       |

- `origin` はサーバーが `"muse"` を記録する。
- 振り返りは新規作成のみ。既存の振り返りの更新・削除は API に持たせない。
- `decisionId` を指定し、その判断が存在しない場合は 404。
- `decisionId` の判断が `stockId` の銘柄に属さない場合は 400 `validation_error`（既存の `saveReviewAction` と同じ制約）。
- `reflection` は本人が書いた本文をそのまま受け取る。Muse が要約・代筆・言い換えをしてはいけない。API は本文の内容（語句・要約）を変えない。保存時の検証は既存の `ReviewSchema` に従い、前後の空白だけは trim される。
- `currentInput` / `summary` / `differences` は Muse が整理した派生データ。`reflection` と混ぜない。
- 成功時は 201。

レスポンス `data`:

| フィールド | 型                 | 意味                                       |
| ---------- | ------------------ | ------------------------------------------ |
| `replayed` | `boolean`          | 再送なら `true`                            |
| `review`   | `Review`           | 作成した振り返り                           |
| `decision` | `Decision \| null` | 紐付けた判断。`decisionId` なしなら `null` |

エラー:

| ステータス | code                     | 条件                                                                      |
| ---------- | ------------------------ | ------------------------------------------------------------------------- |
| 400        | `validation_error`       | UUID 不正、必須欠落、`decisionId` が別銘柄の判断                          |
| 401        | `unauthorized`           | トークンなし・不一致・読み取りトークン                                    |
| 404        | `not_found`              | 書き込みトークン未設定、`stockId` の銘柄がない、`decisionId` の判断がない |
| 409        | `idempotency_key_reused` | 同じキーを別の本文・エンドポイントで使った                                |

リクエスト例:

```http
POST /api/integration/v1/reviews HTTP/1.1
Authorization: Bearer <RULETRADE_WRITE_TOKEN>
Content-Type: application/json; charset=utf-8
```

```json
{
  "clientRequestId": "b8c9d0e1-f2a3-4b4c-8d5e-6f708192a3b4",
  "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
  "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "currentInput": "NAND価格は下がっているが、AI向けの需要は続いている。",
  "summary": "前回の判断から、需要の見方は変わっていない。",
  "differences": ["在庫回転の見方だけが変わった"],
  "reflection": "需要の見方は変わっていないが、在庫を確認する頻度を上げる。"
}
```

レスポンス例（201）:

```json
{
  "generatedAt": "2026-11-07T13:00:00.000Z",
  "data": {
    "replayed": false,
    "review": {
      "id": "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
      "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
      "decisionId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "currentInput": "NAND価格は下がっているが、AI向けの需要は続いている。",
      "summary": "前回の判断から、需要の見方は変わっていない。",
      "differences": ["在庫回転の見方だけが変わった"],
      "reflection": "需要の見方は変わっていないが、在庫を確認する頻度を上げる。",
      "createdAt": "2026-11-07T13:00:00.000Z",
      "origin": "muse"
    },
    "decision": {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "stockId": "3f0c9a52-7d1e-4b6a-9c2f-1a2b3c4d5e6f",
      "type": "buy",
      "rawInput": "キオクシア、AI向けNANDの需要がどこまで続くか見たい。",
      "transcript": null,
      "followUpQuestion": null,
      "followUpAnswer": null,
      "summary": "AI向けNAND需要の継続を期待して購入する。",
      "points": [],
      "thesis": "AI向けNAND需要の継続",
      "assumptions": ["データセンター向けの需要が続く"],
      "reviewConditions": ["NAND価格が2四半期連続で下落する"],
      "addConditions": ["決算で在庫回転が改善する"],
      "reviewAt": "2026-12-07T12:00:00.000Z",
      "reviewDates": ["2026-12-07T12:00:00.000Z"],
      "decidedAt": "2026-11-07",
      "createdAt": "2026-11-07T12:45:00.000Z",
      "origin": "muse"
    }
  }
}
```

## 6. エラーケース一覧

### 6.1 エンドポイント別の該当有無

「404（リソース）」は、パスやクエリで指定した銘柄・判断・売買・受け箱が見つからない場合。これとは別に、必須トークンが未設定の場合は全エンドポイントで 404 `not_found` になる（§2.3）。

| エンドポイント                         | 400 検証 | 401 認証 | 404 リソース | 409 状態・冪等       |
| -------------------------------------- | -------- | -------- | ------------ | -------------------- |
| `GET /status`                          | なし     | あり     | なし         | なし                 |
| `GET /holdings`                        | なし     | あり     | なし         | なし                 |
| `GET /stocks`                          | なし     | あり     | なし         | なし                 |
| `GET /stocks/:id`                      | なし     | あり     | あり         | なし                 |
| `GET /transactions`                    | あり     | あり     | あり         | なし                 |
| `GET /due`                             | なし     | あり     | なし         | なし                 |
| `GET /captures`                        | あり     | あり     | なし         | なし                 |
| `GET /realized-pnl`                    | あり     | あり     | あり         | なし                 |
| `POST /captures`                       | あり     | あり     | あり         | あり（冪等）         |
| `POST /decisions`                      | あり     | あり     | あり         | あり（冪等・受け箱） |
| `POST /transactions/:id/decision-link` | あり     | あり     | あり         | あり（冪等）         |
| `POST /reviews`                        | あり     | あり     | あり         | あり（冪等）         |

- 405 `method_not_allowed` と 500 `internal_error` は全エンドポイントで起こりうる。
- 401 は、トークンなし・不一致・スコープ違いのすべて。
- 404 は、リソースなしと「必須トークン未設定」の両方で同じコード・同じ形にする。

### 6.2 判定の順序

1. パスが存在しなければ 404 `not_found`。
2. そのパスに必要なトークンが未設定なら 404 `not_found`（認証ヘッダより先）。
3. 認証が通らなければ 401 `unauthorized`。
4. メソッドが違えば 405 `method_not_allowed`。
5. JSON の解析・スキーマ検証に失敗すれば 400 `validation_error`。
6. リソースがなければ 404 `not_found`、状態が衝突すれば 409。
7. 書き込みと冪等キーの記録を 1 トランザクションで行う。
8. 予期しない失敗は 500 `internal_error`。詳細は返さない。

### 6.3 共通のエラー例

400 `validation_error`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "リクエストの形式が正しくありません。"
  }
}
```

401 `unauthorized`:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "認証に失敗しました。"
  }
}
```

404 `not_found`:

```json
{
  "error": {
    "code": "not_found",
    "message": "リソースが見つかりません。"
  }
}
```

405 `method_not_allowed`:

```json
{
  "error": {
    "code": "method_not_allowed",
    "message": "このメソッドは許可されていません。"
  }
}
```

409 `capture_not_pending`:

```json
{
  "error": {
    "code": "capture_not_pending",
    "message": "受け箱はすでに整理済みまたは破棄済みです。"
  }
}
```

500 `internal_error`:

```json
{
  "error": {
    "code": "internal_error",
    "message": "サーバー内部でエラーが発生しました。"
  }
}
```

## 7. 実装順と依存

| 順  | Issue | 内容                                                                        | この文書との関係                       |
| --- | ----- | --------------------------------------------------------------------------- | -------------------------------------- |
| 1   | R-02  | `captures`、`origin`、`integration_requests` の追加                         | §2.7、§3.6、§5.1 の前提                |
| 2   | R-03  | 認証部品と `status` / `holdings` / `stocks` / `stocks/:id` / `transactions` | §4.1〜§4.5                             |
| 3   | R-04  | `due` の共通化と `GET /due`                                                 | §4.6                                   |
| 4   | R-06  | 実現損益の計算と `GET /realized-pnl`、`holdings` への合流                   | §4.2、§4.8（計算ルールは R-06 で確定） |
| 5   | R-07  | `captures` の読み書きと記録画面の簡素化                                     | §4.7、§5.2                             |
| 6   | R-08  | `decisions` / `decision-link` / `reviews` の書き戻し                        | §5.3〜§5.5                             |

- R-03 の時点で `GET /holdings` の `realizedProfitLoss` は `null` のまま返す。フィールドを後から増やすと Muse 側の実装が壊れるため、置き場だけ先に固定する。
- R-06 は計算ルールを確定した時点でこの文書の §4.8 を更新する。R-01 では形だけを固定する。
- R-07 の `POST /captures` は `RULETRADE_WRITE_TOKEN` を必要とする。読み取り（R-03）が先にリリースされても、書き込みトークンが未設定なら書き込みだけ 404 になる（§2.3）。

## 8. 設計メモからの変更点

1. **トークン未設定時の扱いをスコープ別にした**。`RULETRADE_READ_TOKEN` 未設定なら読み取りが、`RULETRADE_WRITE_TOKEN` 未設定なら書き込みが 404 になる。読み取り（R-03）が書き込み（R-08）より先にリリースされるため。
2. **認証エラーをすべて 401 `unauthorized` にした**。トークンなし・不一致・スコープ違いを区別しない。トークン比較は定数時間で行う。R-03 / R-08 の受け入れ条件に合わせるため。
3. **PATCH を持たない**。設計メモ §5.1 の「POST / PATCH 系」を「POST 系」と読み替える。更新系エンドポイントが存在しないため。
4. **受け箱の出所列を `origin` にした**。設計メモ §7 の `source` を、`decisions` / `reviews` と同じ `origin`（`"web"` / `"muse"`）に名前を揃える。既存の `decisions` / `reviews` は `"web"` として扱う。
5. **冪等キーは専用テーブル `integration_requests` で管理する**。`decision-link` や「`captureId` 指定で受け箱を整理済みにする」は新しい行を作らないため、各テーブルの列ではなく専用テーブルで管理する。
6. **読み取りに `GET /realized-pnl` を追加した**。全売却済みの銘柄は `/holdings` に出ないため、実現損益を保有一覧だけに置けない。`/holdings` の各銘柄には実現損益合計の置き場（R-06 まで `null`）を用意する。
7. **書き込みの一覧を確定した**。`POST /captures`、`POST /decisions`、`POST /transactions/:id/decision-link`、`POST /reviews` の 4 本。銘柄を新規作成する手段は持たせない（`stockId` は既存銘柄のみ）。`POST /decisions` の `captureId` は同じトランザクションで受け箱を `organized` にし、`decisionId` を紐付ける。受け箱が `pending` でなければ 409。`POST /transactions/:id/decision-link` では、判断と売買の銘柄が違えば 400、存在しなければ 404。紐付け先の差し替えは可とし、`previousDecisionId` を返す。
8. **成功レスポンスを `{ "generatedAt": "...", "data": ... }` に統一した**。一覧・単体・書き込みのすべてで同じ形にする。書き込みは `data.replayed` を持つ。
9. **金額を `{ "amount": number | null, "currency": "JPY" | "USD" | null }` に統一した**。通貨を跨いだ合計は作らず、`totalsByCurrency` に通貨ごとの配列で返す。価格・取得額・損益が不明な場合は `null`。
10. **`GET /status` の項目を固定した**。`apiVersion`、`package.json` の `version`、銘柄数・判断数・売買数・振り返り数、各テーブルの最新 `createdAt`、`pending` の受け箱件数を返す。
11. **参考株価には取得時刻を必ず付ける**。取得に失敗しても保有情報は返し、`quote: null` と `quoteError` で表す（現行画面と同じ）。`priceAt` が `null` なら時刻不明として扱う。

## 9. 未決事項

なし。

- 実現損益の計算ルール（手数料の扱い、平均取得単価との整合）は未決ではなく、R-06 の着手時に `calculatePortfolio` を確認して確定し、この文書の §4.8 を更新する。
- 上記以外で、R-02〜R-08 の実装を止める未決事項はない。
