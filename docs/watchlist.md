# Watchlist MVP

## 概要

Watchlist機能は、ユーザーが気になる銘柄を保存し、買付前に決めるべきルールを整理するためのキャプチャ・プレイスです。

## ディレクトリ構造

```
src/features/watchlist/
├── components/
│   ├── watchlist-summary-card.tsx           # 全体サマリーカード
│   ├── watchlist-item-table.tsx             # アイテム一覧（テーブル）
│   ├── watchlist-empty-state.tsx            # 空の状態表示
│   ├── watchlist-item-form.tsx              # 新規アイテム追加フォーム
│   ├── watchlist-item-detail.tsx            # 個別アイテム詳細表示
│   ├── watchlist-quality-checks-list.tsx    # 品質チェック結果一覧
│   ├── watchlist-review-panel.tsx           # AIレビューパネル
│   └── create-rule-session-from-watchlist-button.tsx  # Rule Session作成ボタン
├── pages/
│   ├── watchlist-page.tsx                   # Watchlistトップページ
│   ├── new-watchlist-item-page.tsx          # 新規アイテム追加ページ
│   └── watchlist-item-detail-page.tsx       # 個別アイテム詳細ページ
├── hooks/
│   ├── use-watchlist.ts                     # Watchlist取得
│   ├── use-watchlist-items.ts               # アイテム一覧取得
│   ├── use-run-watchlist-review.ts          # AIレビュー実行
│   └── use-create-rule-session-from-watchlist.ts  # Rule Session作成
├── types/
│   └── watchlist-item.ts                    # DbWatchlistItem 型定義
├── services/
│   ├── watchlist-service.ts                 # Watchlist CRUD (サーバー)
│   ├── watchlist-item-service.ts            # Watchlist Item CRUD (サーバー)
│   ├── watchlist-review-service.ts          # AIレビュー実行 (サーバー)
│   ├── watchlist-ownership-service.ts       # 所有権チェック (サーバー)
│   └── watchlist-to-rule-session-service.ts # Rule Session変換 (サーバー)
└── prompts/
    ├── watchlist-review-prompt.ts           # 全体レビュー用プロンプト
    └── watchlist-item-review-prompt.ts      # 個別アイテムレビュー用プロンプト
```

```
src/app/watchlist/
├── page.tsx                                 # サーバーコンポーネント（ /watchlist ）
└── items/
    ├── new/page.tsx                         # サーバーコンポーネント（ /watchlist/items/new ）
    └── [itemId]/page.tsx                    # サーバーコンポーネント（ /watchlist/items/:itemId ）
```

## データベース

### watchlists

| カラム        | 型          | 説明                 |
| ------------- | ----------- | -------------------- |
| id            | uuid        | PK                   |
| user_id       | uuid        | FK → users           |
| name          | text        | Watchlist名          |
| base_currency | text        | 基準通貨 (JPY/USD等) |
| description   | text?       | 説明                 |
| created_at    | timestamptz | -                    |
| updated_at    | timestamptz | -                    |

### watchlist_items

| カラム               | 型           | 説明                                                 |
| -------------------- | ------------ | ---------------------------------------------------- |
| id                   | uuid         | PK                                                   |
| watchlist_id         | uuid         | FK → watchlists                                      |
| user_id              | uuid         | FK → users                                           |
| ticker               | text         | 銘柄コード                                           |
| company_name         | text?        | 銘柄名                                               |
| market               | text?        | 市場 (TSE/NYSE等)                                    |
| currency             | text         | 通貨                                                 |
| status               | text         | 状態 (watching/rule_designing/ready/paused/archived) |
| priority             | text         | 優先度 (low/medium/high)                             |
| interest_reason      | text?        | 気になる理由                                         |
| target_price_min     | numeric?     | 買付価格下限                                         |
| target_price_max     | numeric?     | 買付価格上限                                         |
| planned_tranches     | int?         | 分割回数                                             |
| target_multiple      | numeric?     | 目標倍率                                             |
| max_position_percent | numeric?     | 最大投資比率 (%)                                     |
| stop_loss_note       | text?        | 損切り条件メモ                                       |
| take_profit_note     | text?        | 利確条件メモ                                         |
| earnings_note        | text?        | 決算メモ                                             |
| research_notes       | text?        | 調査メモ                                             |
| tags                 | text[]       | タグ                                                 |
| rule_session_id      | uuid?        | FK → rule_design_sessions                            |
| last_reviewed_at     | timestamptz? | 最終AIレビュー日時                                   |
| created_at           | timestamptz  | -                                                    |
| updated_at           | timestamptz  | -                                                    |

### watchlist_reviews

| カラム                  | 型          | 説明                                     |
| ----------------------- | ----------- | ---------------------------------------- |
| id                      | uuid        | PK                                       |
| user_id                 | uuid        | FK → users                               |
| watchlist_id            | uuid        | FK → watchlists                          |
| item_id                 | uuid?       | FK → watchlist_items (null=全体レビュー) |
| review_scope            | text        | "watchlist" または "item"                |
| review_json             | jsonb       | レビュー結果全体                         |
| summary                 | text?       | サマリー (safety_pass時のみ)             |
| readiness_score         | int?        | 準備度スコア (safety_pass時のみ)         |
| needs_more_info         | boolean     | 追加情報必要か                           |
| can_create_rule_session | boolean     | Rule Session化可能か                     |
| safety_passed           | boolean     | セーフティチェック通過                   |
| prompt_version          | text        | 使用プロンプトバージョン                 |
| provider                | text        | AIプロバイダ                             |
| model                   | text        | AIモデル                                 |
| input_tokens            | int?        | 入力トークン数                           |
| output_tokens           | int?        | 出力トークン数                           |
| estimated_cost_usd      | numeric?    | 推定コスト                               |
| latency_ms              | int         | レイテンシ                               |
| error_message           | text?       | エラー時メッセージ                       |
| created_at              | timestamptz | -                                        |

### watchlist_quality_checks

| カラム             | 型          | 説明                   |
| ------------------ | ----------- | ---------------------- |
| id                 | uuid        | PK                     |
| user_id            | uuid        | FK → users             |
| watchlist_id       | uuid        | FK → watchlists        |
| item_id            | uuid?       | FK → watchlist_items   |
| review_id          | uuid        | FK → watchlist_reviews |
| check_key          | text        | チェック識別子         |
| label              | text        | 表示ラベル             |
| status             | text        | pass / warning / fail  |
| severity           | text        | low / medium / high    |
| reason             | text        | 理由                   |
| related_tickers    | text[]      | 関連銘柄               |
| suggested_question | text?       | 確認質問               |
| created_at         | timestamptz | -                      |

## API

### GET /api/watchlist

現在のユーザーのメインWatchlistを取得。

**Response:**

```json
{
  "ok": true,
  "data": {
    "watchlist": { "id": "...", "name": "...", "base_currency": "JPY", ... }
  }
}
```

### GET /api/watchlist/items

Watchlistに登録されたアイテム一覧を取得（archived除く）。

**Response:**

```json
{
  "ok": true,
  "data": {
    "items": [ { "id": "...", "ticker": "6758", ... } ]
  }
}
```

### GET /api/watchlist/items/:itemId

個別アイテムを取得。

### POST /api/watchlist/items

新規アイテムを追加。

### POST /api/watchlist/review

全体AIレビューを実行（itemIdなし）。

### POST /api/watchlist/items/:itemId/review

個別アイテムのAIレビューを実行。

### POST /api/watchlist/items/:itemId/create-rule-session

アイテムからRule Sessionを作成。

**Response:**

```json
{
  "ok": true,
  "data": { "sessionId": "..." }
}
```

## AIレビューの方針

1. レビューはAIプロバイダー（OpenAI/Anthropic等）を通して実行
2. 出力はZod Schemaでバリデーション
3. セーフティチェックを通過した結果のみを表示
4. レビュー履歴は `watchlist_reviews` テーブルに保存
5. 品質チェック結果は `watchlist_quality_checks` テーブルに個別保存
6. プロンプトはバージョン管理され、実績とともに保存

## Rule Session連携

WatchlistのアイテムからRule Sessionを作成する際、既存の入力データ（target_price等）がルール設計セッションにプリフィルされます。これにより、ユーザーは既に入力した情報を再入力することなく、ルールの詳細設計に進めます。

## 今後の拡張案

- ウォッチリストの複数作成・管理
- 自動価格取得・通知
- バルクインポート（CSV等）
- 共有・コラボレーション機能
