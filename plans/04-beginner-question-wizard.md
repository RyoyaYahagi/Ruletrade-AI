# 04. 初心者向け質問ウィザード（低負荷回答・わからないボタン）

## 目的

銘柄別ルールを作る質問フローを、投資初心者が答え切れるものにする。

設計原則:
1. **1 画面 1 問**。進捗が見える。途中離脱しても再開できる（既存のセッション機構で可能）。
2. **回答は原則タップで完了**。自由記述を求めるのは投資仮説の 1 箇所だけで、
   それも LLM が選択回答から下書きを作り、ユーザーは編集・承認するだけにする。
3. **全質問に「まだ決めていない / わからない」がある**。選ぶと安全側のデフォルト案と
   短い解説が提示され、ユーザーはタップで採用できる。「わからない」を罰しない。
4. **質問カタログは固定のコード**にする。LLM に質問を発明させない
   （コスト削減・出力の安定・レビュー可能性のため）。LLM の役割は
   (a) 仮説文と破れ条件の下書き生成、(b) 追加質問の提案（既存機構、上限あり）のみ。

## 依存関係

- 計画 03（`thesisBreakers` / `monitoring` フィールド）が先。
- 計画 05 の `runMeteredAiCall` があればそれを使う。無ければ既存の
  `checkAiCostLimit` → `callAi` → `incrementAiCostUsage` を直接並べ、計画 05 実装時に置換する。

## 最初に読むファイル

- `src/features/rules/services/rule-question-service.ts`（質問の作成と取得。変更対象）
- `src/features/rules/services/rule-answer-service.ts`（回答保存）
- `src/features/rules/components/answer-input.tsx`（回答 UI。対応済み question_type を確認）
- `src/features/rules/components/question-card.tsx` と `rule-session-shell.tsx`
- `src/app/api/rule-sessions/[sessionId]/next-question/route.ts` ほか同階層のルート
- `src/lib/db/sqlite-schema.ts` の `rule_questions` テーブル定義
- `src/features/glossary/` （用語解説の既存実装。help との連携に使う）

## やらないこと

- 既存の question_type（single_choice / multiple_choice / price_range / yes_no / free_text）の削除
- 質問文の LLM 動的生成（固定カタログでいく）
- セッション機構・所有権チェックの再実装（既存を使う）

## データモデル

`rule_questions` テーブルに列を 2 つ追加する。
`src/lib/db/sqlite-schema.ts` の `initializeSqliteSchema` 内 `ensureColumn` 呼び出しに追加:

```ts
ensureColumn(db, "rule_questions", "allow_unknown", "integer not null default 1");
ensureColumn(db, "rule_questions", "unknown_default_json", "text");
```

- `allow_unknown`: 1 なら UI に「まだ決めていない」ボタンを表示する。
- `unknown_default_json`: 「わからない」選択時に提案するデフォルト値と解説。
  形式: `{ "value": <回答値>, "label": "初心者向けの標準設定", "explanation": "…" }`

`rule_answers.answer_json` には、わからない経由の回答を
`{ "unknown": true, "appliedDefault": true, "value": ... }` の形で保存する（新テーブル不要）。

## 実装ステップ

### ステップ 1: 質問カタログの作成

ファイル: `src/features/rules/constants/question-catalog.ts`（新規）

固定の質問配列を定義する。既存 `createInitialQuestions` の 3 問を置き換える形で、
以下の 10 問を `display_order` 順に定義する。各要素は `rule_questions` の insert 形式に合わせる。

| # | question_key | 形式 | 質問文 | maps_to_rule_field | わからない時のデフォルト |
|---|-------------|------|--------|--------------------|--------------------|
| 1 | holding_purpose | single_choice | この銘柄を持つ一番の目的は？ | purpose | `learning`（解説: まず少額で学ぶ位置づけにする） |
| 2 | time_horizon | single_choice | どれくらいの期間で考えていますか？ | timeHorizon | `long_term`（解説: 迷ったら長期前提が安全） |
| 3 | thesis_seed | multiple_choice | 買いたい理由に近いものを全部選んでください（選択肢: 事業が成長しそう / 株価が割安に見える / 配当や優待 / 応援したい・好き / 話題になっている / その他） | （仮説下書きの材料。rule_json へは直接入れない） | 選択なしで次へ進める |
| 4 | thesis_draft | free_text | あなたの投資仮説（AI が下書きを作成、編集して確定） | investmentThesis | デフォルトなし（下書き必須） |
| 5 | thesis_breakers_pick | multiple_choice | どうなったら「見立てが外れた」と考えますか？（選択肢は #3 の回答から LLM が 4 件生成。生成失敗時は固定の汎用 4 件） | thesisBreakers | 汎用 4 件から選択 |
| 6 | stop_loss_review | percent_slider | 買値からどれくらい下がったら一度見直しますか？（範囲 5〜40%、刻み 5%） | monitoring.stopLossReviewPercent | `15`（解説: 一般に 10〜20% がよく使われる。深くするほど損失は大きくなる） |
| 7 | take_profit_review | percent_slider | どれくらい上がったら一度見直しますか？（範囲 10〜100%、刻み 10%、「決めない」可） | monitoring.takeProfitReviewPercent | 未設定（解説: 利益側は決めない人も多い。下落側だけ決めるのでもよい） |
| 8 | max_position | percent_slider | 資産全体のうち、この銘柄に最大何%まで入れますか？（範囲 1〜30%、刻み 1%） | riskManagement.maxPositionPercent | `10`（解説: 1 銘柄への集中を避ける目安として 10% 以下がよく使われる） |
| 9 | earnings_policy | single_choice | 決算発表の前後はどうしますか？ | earningsPolicy.policy | `review_before_earnings` |
| 10 | review_cycle | single_choice | このルールをどの頻度で見直しますか？ | monitoring.reviewCycle | `quarterly`（解説: 決算ごとの見直しが基本） |

デフォルト値の解説文は上記を出発点に、**断定・推奨にならない表現**（「よく使われる」「目安」）で書く。
「〜すべき」「おすすめ」は禁止（`prohibited-phrases` に触れる）。

### ステップ 2: percent_slider 質問タイプの追加

ファイル: `src/features/rules/components/answer-input.tsx`（変更）

- `question_type === "percent_slider"` の分岐を追加。
- `options` 列（JSON）に `{ "min": 5, "max": 40, "step": 5, "presets": [{"label":"かため","value":10},{"label":"標準","value":15},{"label":"ゆるめ","value":20}] }` を入れる想定で描画する。
- UI 構成: プリセット 3 ボタン（タップで即回答）+ スライダー（微調整したい人向け）。
  プリセットを先に、スライダーは折りたたみで下に置く（初心者はタップだけで済む）。

### ステップ 3: 「まだ決めていない」ボタン

ファイル: `src/features/rules/components/answer-input.tsx`（変更）と
`src/features/rules/components/question-card.tsx`（変更）

- `allow_unknown === 1` の質問に、回答 UI の下に「まだ決めていない」ボタンを表示。
- タップすると `unknown_default_json` の内容をカードで表示:
  デフォルト値 + `label` + `explanation` + 2 ボタン「この設定を使う」「あとで決める」。
  - 「この設定を使う」→ 回答として保存（`answer_json: { unknown: true, appliedDefault: true, value }`）
  - 「あとで決める」→ 質問を `skipped` 状態にして次へ（既存の status 語彙を確認し、
    無ければ `status: "skipped"` を追加。skipped は finalize 時の品質チェックで警告対象になる）
- `unknown_default_json` が null の質問（thesis_draft）ではボタンを出さない。

### ステップ 4: 仮説下書きの LLM 生成

ファイル: `src/features/rules/services/thesis-draft-service.ts`（新規）

```ts
export async function generateThesisDraft(params: {
  userId: string;
  sessionId: string;
}): Promise<{ thesisDraft: string; breakerCandidates: ThesisBreaker[] }>;
```

- 入力: セッションの ticker / company_name と、#1〜#3 の回答（`rule_answers` から取得。
  所有権チェックとして必ず `.eq("user_id", ...)` を付ける）。
- `callAi` を `taskWeight: "standard"` で呼ぶ。出力は zod スキーマ
  `z.object({ thesis: z.string().max(400), breakers: z.array(z.object({ description: z.string().max(200), newsKeywords: z.array(z.string()).max(5) })).length(4) })`
  で受ける。パース失敗はエラーとして返す（勝手な文字列で埋めない）。
- プロンプトは `src/features/rules/prompts/`（無ければ新規作成）に定数として置く。
  プロンプトに含める制約: 「一人称で書く」「買い推奨の表現をしない」「ユーザーが選んだ理由だけを根拠にする」
  「破れ条件は観測可能な事実にする（例: 主力事業の減収が 2 四半期続く）」。
- コスト: 計画 05 の `runMeteredAiCall` を `feature: "thesis_draft"` で使う
  （未実装なら `checkAiCostLimit` → `callAi` → `incrementAiCostUsage` を直接並べる）。
- 表示前に `safety-check-service` を通す（既存のルールレビューと同じ経路）。

API ルート: `src/app/api/rule-sessions/[sessionId]/thesis-draft/route.ts`（新規、POST）。
標準形（requireUser → サービス → apiSuccess）。セッションの所有権は
`rule-ownership-service.ts` の既存関数で検証する。

### ステップ 5: 質問フローへの組み込み

ファイル: `src/features/rules/services/rule-question-service.ts`（変更）

- `createInitialQuestions` を質問カタログ（ステップ 1）から insert するよう書き換える。
- #4 thesis_draft の質問カードでは、フロントが先に `POST .../thesis-draft` を呼び、
  返ってきた下書きを textarea の初期値として表示する。#5 の選択肢は
  `breakerCandidates` を `rule_questions.options` に保存して出題する
  （LLM 失敗時は固定の汎用 4 件: 「業績が 2 四半期連続で悪化」「主力製品・サービスの競争力低下のニュース」「経営陣の不祥事」「買った理由が自分でも説明できなくなった」）。
  LLM 失敗時に汎用選択肢を使うのは**明示的に許可されたフォールバック**である。
  フォールバック発動時は `answer_json` に `{ "breakerSource": "fallback" }` を記録し、
  UI に「AI 下書きが作れなかったため、一般的な選択肢を表示しています」と表示すること。

### ステップ 6: ドキュメント

- `docs/rule-workbench.md`（存在を確認）に質問カタログの一覧と「わからない」の挙動を追記。

## テスト

置き場所: `tests/features/rules/`

必須ケース:

1. `createInitialQuestions` がカタログの全 10 問を display_order 順に作成する
2. 他ユーザーの sessionId で thesis-draft API を呼ぶと 403/404 になる（**所有権テスト**）
3. `generateThesisDraft` が LLM 出力のパース失敗時にエラーを返す（Mock プロバイダで不正 JSON を返させる）
4. 「わからない」回答が `answer_json.unknown === true` で保存され、rule_json にデフォルト値が反映される
5. percent_slider の回答値が `monitoring.stopLossReviewPercent` に数値として入る
6. 破れ条件のフォールバック発動時に `breakerSource: "fallback"` が記録される
7. コスト上限超過時（`cost_limit_counters` を上限まで埋めてから呼ぶ）に
   thesis-draft API が 402 を返し、質問フロー自体は継続できる

E2E（`tests/e2e/` の既存パターンに従う）:

8. 新規セッション開始 → 10 問すべて「タップのみ」（プリセット・選択肢・わからない）で
   finalize 直前まで到達できる（自由記述は thesis の編集を除き発生しないことを確認）

## 完了条件

- [ ] 全 10 問が 1 画面 1 問で出題され、進捗が表示される
- [ ] 自由入力が必須なのは仮説の編集 1 箇所だけ
- [ ] すべての質問（thesis_draft を除く）に「まだ決めていない」があり、デフォルト提案が機能する
- [ ] LLM 呼び出しは thesis 下書き（standard）1 回 + 破れ条件候補（同一呼び出しに同梱）のみ
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
