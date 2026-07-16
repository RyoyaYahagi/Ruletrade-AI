# 06. 価格条件の成立通知（決定的判定・LLM 不使用）

## 目的

日次価格（計画 02）と銘柄別ルールの監視設定（計画 03）を突き合わせ、
条件が成立したら通知を作る。**この計画に LLM は登場しない**。すべて決定的コードで行う。

対象とする条件（すべて数値比較）:

| 条件 | 使うフィールド | 判定式 |
|------|--------------|--------|
| 下落見直し | `monitoring.stopLossReviewPercent` | 最新終値 <= 取得平均価格 × (1 - p/100) |
| 上昇見直し | `monitoring.takeProfitReviewPercent` | 最新終値 >= 取得平均価格 × (1 + p/100) |
| 高値からの下落 | `monitoring.drawdownFromHighPercent` | 最新終値 <= 直近 365 日の最高終値 × (1 - p/100) |
| 目標価格到達 | `exitPlan.targetPrice`（既存フィールド） | 最新終値 >= targetPrice |
| クールダウン | `monitoring.cooldownDailyDropPercent` | 当日終値が前営業日終値比 -p% 以下 |
| 価格未更新 | （ルール不要） | 保有銘柄の最新 quote_date が 4 暦日以上前 |

## 依存関係

- 計画 02（price_quotes）と計画 03（monitoring フィールド）が先。
- 計画 01 の ADR（通知文言規約）に従う。

## 最初に読むファイル

- `src/features/notifications/services/notification-service.ts`（通知の作り方・列名）
- `src/features/notifications/services/reminder-detection-service.ts`
  （検知→通知作成の既存パターン。この計画の手本）
- `src/features/notifications/services/notification-delivery-service.ts`
- `src/lib/prices/price-quote-service.ts`（計画 02 の成果物）
- `src/features/rules/services/rule-session-service.ts`
  （承認済みルールと ticker の取得方法）
- `src/features/portfolio/services/portfolio-position-service.ts`（取得平均価格の列名）

## やらないこと

- 売買の実行・提案（絶対にしない）
- LLM の使用（価格判定に意味解釈は不要）
- push / メール通知（既存方針どおりアプリ内通知のみ）
- 分足・ザラ場中の判定（日次終値のみ）

## データモデル

通知の重複防止テーブルを `src/lib/db/sqlite-schema.ts` に**明示定義**で追加
（unique 制約が必要）:

```sql
create table if not exists rule_alert_events (
  id text primary key,
  user_id text not null,
  session_id text not null,        -- rule_design_sessions.id
  condition_key text not null,     -- 'stop_loss_review' など下表の値
  quote_date text not null,        -- 判定に使った終値の日付
  triggered_value real,            -- 判定時の株価
  threshold_value real,            -- 閾値
  notification_id text,
  created_at text not null default (datetime('now')),
  unique (session_id, condition_key, quote_date)
)
```

`condition_key` の語彙（定数化する）:
`stop_loss_review` / `take_profit_review` / `drawdown_from_high` /
`target_price_reached` / `cooldown_triggered` / `price_data_stale`

**重複防止の方針**: unique 制約により「同じルール×同じ条件×同じ終値日」は 1 回しか通知しない。
翌日も条件を満たし続けている場合は再通知**しない**——
連日同じ通知を送るとユーザーが通知を無視するようになるため。
再通知するのは、一度条件を外れて（終値が閾値の内側に戻って）再度成立した場合のみ。
これを実現するため、判定時に「前営業日の終値は条件を満たしていなかったか」も確認する
（`price_quotes` から前日分を引くだけでよい）。

## 実装ステップ

### ステップ 1: 判定サービス

ファイル: `src/features/notifications/services/price-alert-detection-service.ts`（新規）

```ts
export async function detectPriceAlerts(params: {
  userId: string;
}): Promise<{ createdCount: number }>;
```

処理:

1. ユーザーの承認済みルールセッションを取得
   （`rule_design_sessions` を `.eq("user_id", ...)` + status が承認相当のもの。
   status の語彙は `rule-session-service.ts` を読んで確認する）。
2. 各セッションの `rule_json` を `TradeRuleSchema.parse` し、監視フィールドを読む。
   パース失敗はそのセッションをスキップし、スキップ数を戻り値に含める（黙殺しない）。
3. ticker に対応する `price_quotes` の最新値・前日値・365 日高値を取得。
4. 冒頭の表の判定式を順に評価。成立したら:
   - 前日終値が同条件を満たしていた場合はスキップ（再通知抑制）
   - `rule_alert_events` に insert（unique 衝突 = 通知済みなのでスキップ）
   - `createNotification`（notification-service の既存関数）で通知作成
5. 取得平均価格はポートフォリオの該当ポジションから取る。
   ポジションが無い銘柄（ウォッチのみ）は、取得価格を使う条件（下落/上昇見直し）を
   スキップし、目標価格・高値下落条件のみ判定する。

### ステップ 2: 通知文言

定数ファイル: `src/features/notifications/constants/price-alert-messages.ts`（新規）

ADR の 3 要素規約（事実 + ルール参照 + 確認の促し）で全 condition_key 分を定義する。例:

- `stop_loss_review`:
  「{company} ({ticker}) の終値 {price} 円が、あなたのルール『買値から -{threshold}% で見直す』の条件を満たしました。ルールを確認してください。」
- `target_price_reached`:
  「{company} ({ticker}) の終値が、あなたが設定した目標価格 {target} 円に到達しました。出口ルールを確認してください。」
- `cooldown_triggered`:
  「{company} ({ticker}) は本日 {drop}% 下落しました。あなたのルールでは、急落日から {hours} 時間は操作しないと決めています。」
- `price_data_stale`:
  「{company} ({ticker}) の価格が {days} 日間更新できていません。表示中の評価額は古い可能性があります。」

禁止: 「売却を検討」「利益確定のチャンス」等の行動指示。
このファイルの文言をテストで `detectProhibitedPhrases` に通し、禁止語ゼロを機械的に保証する。

### ステップ 3: cron への組み込み

ファイル: `src/app/api/cron/prices/daily/route.ts`（計画 02 で作成済み。変更）

価格保存の**後**に、対象ユーザー（`notification_preferences.in_app_enabled = true`、
既存 cron と同じ絞り方）ごとに `detectPriceAlerts` を実行する。
レスポンスに `alertCreatedCount` を追加する。

価格取得と判定を同一 cron にする理由（コメントに書く）: 判定は必ず最新価格の保存後に
走る必要があり、別 cron にすると順序保証が環境設定依存になるため。

### ステップ 4: 通知への 3 アクション

ファイル: 通知一覧の既存 UI（`src/app/notifications/` と
`src/features/notifications/components/notification-bell.tsx` を確認）に、
`rule_price_condition_met` 系の通知だけアクションボタンを追加する:

1. 「ルールを確認」→ `/rules/{sessionId}`（既存のルール詳細ページ）へ遷移
2. 「仮説を維持（記録する）」→ 既存の notifications dismiss API を呼び、
   `rule_alert_events` の該当行に `resolution: "kept"` 列を追加保存
3. 「ルールを見直す」→ ルール編集（既存のセッション再開導線）へ遷移し、`resolution: "revising"` を保存

`resolution` 列は自動作成される（新規列を含む update をすると `ensureTableForRow` が列を追加する）。

## テスト

置き場所: `tests/features/notifications/`（無ければ新規）

必須ケース（価格は `MockPriceProvider` またはテスト内で `price_quotes` を直接 insert して作る）:

1. 取得平均 1000 円・stopLossReviewPercent 15・終値 840 円 → 通知が 1 件できる
2. 同条件で同日 2 回実行しても通知は 1 件のまま（unique 制約）
3. 前日終値 830 円（すでに成立）・当日 820 円 → 再通知しない
4. 前日 900 円（未成立）→ 当日 840 円 → 通知される
5. 目標価格 2000 円・終値 2010 円 → `target_price_reached` 通知
6. ウォッチのみ（ポジション無し）の銘柄では stop_loss_review が発火しない
7. rule_json が壊れているセッションはスキップされ、他のセッションの判定は続行される
8. ユーザー A のルールに対する通知がユーザー B に作られない（**所有権テスト**）
9. 全通知文言が `detectProhibitedPhrases` で禁止語ゼロ

## 完了条件

- [ ] 日次 cron 実行で、条件成立ルールに通知が 1 回だけ作られる
- [ ] 通知から「確認 / 維持 / 見直す」の 3 アクションが取れる
- [ ] LLM 呼び出しがこの機能のコードパスに存在しない（grep で `callAi` が無いことを確認）
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
