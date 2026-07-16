# 03. 銘柄別ルールへの監視用フィールド追加

## 目的

銘柄別ルール（`rule_design_sessions.rule_json`、スキーマは `TradeRuleSchema`）に、
自動監視（計画 06・08）が機械的に読めるフィールドを追加する。

現状の `TradeRuleSchema`（`src/schemas/rules/trade-rule-schema.ts`）には
investmentThesis / riskManagement.maxLossPercent / exitPlan.targetPrice /
exitTriggers（自由文）/ earningsPolicy が既にある。**既存フィールドは変更せず**、
足りないものだけを追加する。

追加するのは 2 つ:
1. **仮説の破れ条件（thesisBreakers）** — ニュース照合（計画 08）が使う構造化リスト
2. **監視設定（monitoring）** — 決定的な価格判定（計画 06）が使う数値と、
   クールダウン・レビュー周期の設定

## 依存関係

なし（計画 01 と並行可能）。計画 04・06・08 がこの計画に依存する。

## 最初に読むファイル

- `src/schemas/rules/trade-rule-schema.ts`（変更対象。全文を読む）
- `src/schemas/common/primitive-schema.ts`（`PercentageSchema` などの既存プリミティブ）
- `src/features/rules/services/trading-rule-validation.ts`（決定的バリデーションの現状）
- `src/features/rules/services/rule-review-service.ts`（品質チェックがどう作られるか）
- `docs/trading-rules.md`（ドキュメント更新対象）

## やらないこと

- 既存フィールドのリネーム・削除（後方互換を壊さない。既存の rule_json はそのまま読めること）
- 監視の実行ロジック（計画 06・08 で実装する。ここではスキーマとバリデーションのみ）
- UI の変更（質問ウィザードは計画 04）

## 実装ステップ

### ステップ 1: スキーマ追加

ファイル: `src/schemas/rules/trade-rule-schema.ts`（変更）

以下を追加する。**すべて optional / default 付き**にして、既存データがバリデーションを通ることを保証する。

```ts
export const ThesisBreakerSchema = z.object({
  // ユーザーの言葉で書かれた「こうなったら仮説は崩れた」条件
  description: z.string().min(1).max(500),
  // ニュース照合の手がかりになるキーワード（計画08で使用。空でもよい）
  newsKeywords: z.array(z.string().min(1).max(50)).max(10).default([]),
});

export const ReviewCycleSchema = z.enum([
  "monthly",
  "quarterly",
  "after_earnings",
  "undecided",
]);

export const MonitoringSettingsSchema = z.object({
  // 取得平均価格からの下落率で「見直し」通知を出す閾値（例: 15 = -15%で通知）
  stopLossReviewPercent: PercentageSchema.optional(),
  // 取得平均価格からの上昇率で「見直し」通知を出す閾値
  takeProfitReviewPercent: PercentageSchema.optional(),
  // 直近1年高値からの下落率で通知する閾値
  drawdownFromHighPercent: PercentageSchema.optional(),
  // 1日でこの%以上下落した日は操作しないと決めるクールダウン
  cooldownDailyDropPercent: PercentageSchema.optional(),
  cooldownHours: z.number().int().min(1).max(168).default(24),
  reviewCycle: ReviewCycleSchema.default("undecided"),
});
```

`TradeRuleSchema` に 2 フィールドを追加:

```ts
thesisBreakers: z.array(ThesisBreakerSchema).max(10).default([]),
monitoring: MonitoringSettingsSchema.default({
  cooldownHours: 24,
  reviewCycle: "undecided",
}),
```

型のエクスポートも追加: `export type ThesisBreaker = ...`, `export type MonitoringSettings = ...`。

注意: `riskManagement.maxLossPercent`（既存）と `monitoring.stopLossReviewPercent`（新規）は
役割が違う。前者は「1 トレードで許容する最大損失」という自己申告、後者は
「この下落率で見直し通知を出す」という監視トリガー。混同して片方を削除しないこと。

### ステップ 2: 決定的バリデーションの追加

ファイル: `src/features/rules/services/trading-rule-validation.ts`（変更）

既存の `validateTradingRule` と同じパターンで、警告を追加する
（この関数が `TradeRule`（trade-rule-schema 由来）を受けていない場合は、
rule-review-service 側の品質チェック生成箇所を探し、そこに追加する。
どちらに追加したかを PR に明記すること）。

追加する品質チェック（既存の `rule_quality_checks` の severity 語彙に合わせる）:

| check_key | 条件 | severity | ブロッカー |
|-----------|------|----------|-----------|
| `missing_thesis_breakers` | `investmentThesis` があるのに `thesisBreakers` が空 | warning | いいえ |
| `missing_monitoring_threshold` | `monitoring` の価格系 3 閾値がすべて未設定 | warning | いいえ |
| `contradictory_monitoring` | `stopLossReviewPercent` >= 100、または `takeProfitReviewPercent` が 0 | blocker | はい |

ブロッカーにしない理由（コメントとしてコードに書く）: 監視は任意機能であり、
未設定でもルール自体は成立する。ただし「仮説だけあって破れ条件がない」は
振り返り不能なルールになるため警告する。

### ステップ 3: 質問→ルール反映のマッピング確認

ファイル: `src/features/rules/services/rule-answer-service.ts` と
`src/features/portfolio/services/portfolio-rule-answer-mapping.ts` を読み、
`maps_to_rule_field` の値がどう rule_json に反映されるかを確認する。

新フィールド用のマッピング先文字列を決めて定数化する:
`"thesisBreakers"` / `"monitoring.stopLossReviewPercent"` /
`"monitoring.takeProfitReviewPercent"` / `"monitoring.cooldownDailyDropPercent"` /
`"monitoring.reviewCycle"`。
ネストしたパスへの代入処理が存在しない場合はここで実装する
（`lodash.set` は追加せず、単純な 2 階層 split で書く）。

### ステップ 4: ドキュメント更新

- `docs/trading-rules.md` の Rule Structure に `thesisBreakers` と `monitoring` を追記。
- 各フィールドの意味と、「監視トリガーは通知を出すだけで、売買を実行しない」ことを 1 行書く。

## テスト

置き場所: `tests/features/rules/`（既存フォルダ）

必須ケース:

1. 旧形式の rule_json（`thesisBreakers` / `monitoring` 無し）が `TradeRuleSchema.parse` を通り、
   default 値が入る（後方互換）
2. `thesisBreakers` に 11 件入れると parse が失敗する（max 10）
3. `stopLossReviewPercent: 150` で品質チェック `contradictory_monitoring` が blocker になる
4. `investmentThesis` あり + `thesisBreakers` 空 → `missing_thesis_breakers` 警告が出る
5. 全監視閾値未設定 → `missing_monitoring_threshold` 警告が出る
6. ネストパス `monitoring.stopLossReviewPercent` への回答反映が正しく rule_json に入る

## 完了条件

- [ ] 既存の rule_json がすべてバリデーションを通る（後方互換）
- [ ] 新フィールドが `TradeRuleSchema` に入り、型がエクスポートされている
- [ ] 品質チェック 3 種が動き、`rule_quality_checks` に記録される
- [ ] `docs/trading-rules.md` が更新されている
- [ ] `npm run typecheck && npm run lint && npm run test` が通る
