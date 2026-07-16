# 07. ターゲット配分とドリフト検知通知

## 目的

ユーザーが「自分のポートフォリオのあるべき形」（ターゲット配分）を定義し、
日次価格でそこからの乖離（ドリフト）を検知して通知する。

コンプライアンス境界（ADR 準拠）:
- アプリは**最適な配分を提案しない**。ターゲットはユーザーが決める。
- 通知は「あなたの決めたターゲットから X% 乖離した」という事実のみ。
  リバランス（売買）の指示・提案はしない。
- 初心者向けの補助として、リスク許容度別の**一般的な例**を静的コンテンツとして
  見せるのは可（「保守的な配分の例としてよく紹介される形」）。個別化した提案は不可。

## 依存関係

- 計画 02（価格基盤）が先。計画 06 と同じ cron に載せる。

## 最初に読むファイル

- `src/features/portfolio/services/portfolio-service.ts` と
  `portfolio-aggregation-service.ts`（評価額・現金の扱いを確認）
- `src/features/portfolio/services/portfolio-compliance-service.ts`
  （既存の「集中リスク指摘」との重複を避けるため必読）
- `src/app/api/portfolio/` 配下のルート構成
- 計画 06 の `rule_alert_events`（重複防止パターンを流用）

## やらないこと

- リバランス注文の計算・提案（「A を X 株売って B を買う」は出さない）
- セクター自動分類（セクターはユーザーが任意入力。未入力ならセクター判定をスキップ）
- 最適化アルゴリズム（平均分散最適化など）の導入

## データモデル

`src/lib/db/sqlite-schema.ts` に明示定義で追加:

```sql
create table if not exists portfolio_targets (
  id text primary key,
  user_id text not null,
  portfolio_id text not null,
  target_type text not null,       -- 'cash_percent' | 'position_max_percent' | 'position_target_percent'
  target_key text,                 -- position系: symbol。cash_percent: null
  target_percent real not null,
  tolerance_percent real not null default 5,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (portfolio_id, target_type, target_key)
)
```

- `cash_percent`: 現金比率の目標（例: 30% ± 5%）
- `position_max_percent`: 1 銘柄の上限（target_key = symbol、または target_key = '*' で全銘柄一律）
- `position_target_percent`: 特定銘柄の目標比率（任意。設定しない運用も普通にあり得る）

ドリフト通知の重複防止は計画 06 の `rule_alert_events` と同じ方式で、
専用テーブル `drift_alert_events`（unique (portfolio_id, target_type, target_key, quote_date)）を追加する。

## 実装ステップ

### ステップ 1: ターゲット CRUD

サービス: `src/features/portfolio/services/portfolio-target-service.ts`（新規）

- `listTargets({ userId, portfolioId })` / `upsertTarget({ userId, portfolioId, ... })` /
  `deleteTarget({ userId, targetId })`
- すべてのクエリに `.eq("user_id", ...)` を付ける。
- バリデーション: `target_percent` は 0〜100、`tolerance_percent` は 1〜20。
  合計チェックはしない（position_target_percent は一部銘柄のみ設定でも成立するため）。

API: `src/app/api/portfolio/targets/route.ts`（GET / POST）と
`src/app/api/portfolio/targets/[targetId]/route.ts`（DELETE）。標準形で書く。

### ステップ 2: ドリフト計算（純関数）

ファイル: `src/features/portfolio/services/portfolio-drift-service.ts`（新規）

計算部分は DB を触らない純関数として書く（テストしやすさのため）:

```ts
export type DriftFinding = {
  targetType: string;
  targetKey: string | null;
  currentPercent: number;
  targetPercent: number;
  tolerancePercent: number;
  driftPercent: number;      // currentPercent - targetPercent
  exceeded: boolean;         // |driftPercent| > tolerancePercent（max系は超過方向のみ）
};

export function calculateDrift(params: {
  positions: Array<{ symbol: string; valuationJpy: number }>;
  cashJpy: number;
  targets: Array<PortfolioTarget>;
}): DriftFinding[];
```

- 評価額は計画 02 の自動価格を使った円建て評価（aggregation-service の結果）を渡す。
- `position_max_percent` は上回った場合のみ `exceeded: true`（下回りは正常）。
- `cash_percent` と `position_target_percent` は両方向で判定。
- 価格が stale なポジションが 1 つでもある場合、結果に `hasStaleData: true` を含め、
  通知本文に「一部の価格が古いため概算です」を付ける（黙って古い値で断定しない）。

### ステップ 3: 検知と通知

`src/features/notifications/services/drift-alert-detection-service.ts`（新規）を作り、
計画 06 と同じ cron（`/api/cron/prices/daily`）の判定フェーズに追加する。

通知文言（`price-alert-messages.ts` と同様に定数化 + 禁止語テスト）:

- 超過: 「{symbol} が資産の {current}% になり、あなたが決めた上限 {target}% を {drift}pt 超えています。ポートフォリオを確認してください。」
- 現金: 「現金比率が {current}% になり、あなたの目標 {target}%±{tolerance}% から外れています。」

再通知抑制も計画 06 と同じ: 同じ (target, quote_date) は 1 回、
連日継続は再通知せず、一度解消して再発したときだけ通知。

### ステップ 4: 設定 UI

ファイル: `src/app/portfolio/targets/page.tsx`（新規）+
`src/features/portfolio/components/portfolio-targets-form.tsx`（新規）

- 現金比率目標（スライダー + 許容幅）、1 銘柄上限（全銘柄一律 '*' をデフォルト提示）、
  銘柄別目標（任意追加）の 3 セクション。
- 現在値との比較バーを表示: 目標レンジを帯、現在値を点で示す
  （数値の羅列にしない。計画 10 の UX 方針を先取りする）。
- 静的な参考例を折りたたみで表示: 「よく紹介される例: 現金 20〜40% / 1 銘柄 10% 以下」。
  文言は断定を避け、出典を書かない推奨表現も避ける。

## テスト

置き場所: `tests/features/portfolio/`

必須ケース:

1. `calculateDrift`: 現金 25% / 目標 30% / 許容 5 → exceeded false（境界値ちょうどは false）
2. `calculateDrift`: 現金 24% / 目標 30% / 許容 5 → exceeded true、driftPercent = -6
3. `position_max_percent` は下回りで exceeded false、上回りで true
4. stale 価格を含む場合 `hasStaleData: true` になり、通知本文に概算の断りが入る
5. 他ユーザーの portfolioId でターゲット CRUD が 403/404 になる（**所有権テスト**）
6. 同一 (target, quote_date) の重複通知が作られない
7. 通知文言が禁止語ゼロ（`detectProhibitedPhrases`）

## 完了条件

- [ ] ターゲット配分を設定でき、画面で現在値との差が視覚的にわかる
- [ ] 日次 cron で許容幅超過時に 1 回だけ通知される
- [ ] リバランスの売買提案がどこにも表示されない
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
