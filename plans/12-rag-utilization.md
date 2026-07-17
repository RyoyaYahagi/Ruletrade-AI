# 12. RAG 活用の拡張（過去の自分を参照する仕組み）

## 目的

既存の RAG 基盤を「新機能が生む判断記録」に接続し、AI 出力の質を上げる。

この製品での RAG の価値は一般的な文書検索ではなく、
**「過去の自分の判断・ルール・振り返り」を現在の判断の参照点として引き出す**ことにある。
感情に流されない取引とは、過去の冷静な自分との一貫性を保つことだからである。

**既にあるもの（再実装しないこと）**:

- RAG 基盤一式: `src/features/rag/services/`（build-rag-document / upsert-rag-sources /
  reindex-user-rag-documents / retrieve-rag-context）と `src/lib/rag/`（chunk-text / hash-content）
- 埋め込みプロバイダ切替: `src/lib/ai/embeddings/`
- 検索は `retrieveRagContext({ userId, taskType, queryText, sourceTypes, ... })` で
  source_types 絞り込み・類似度閾値・文字数上限に対応済み
- 現在の利用箇所: rule review（`rule-review-service.ts`）のみ
- プライバシー削除: `/api/privacy/delete/rag-memory` が存在する

**この計画で足すもの**: 新しい RAG ソース 3 種と、利用箇所 3 つ。

## 依存関係

- 各ステップが依存する計画: ステップ 2 → 計画 06、ステップ 3 → 計画 04、
  ステップ 4 → 計画 08、ステップ 5 → 計画 09。
  依存先が未実装のステップは飛ばし、実装済みのものから順に入れられる構成にしてある。

## 最初に読むファイル

- `src/features/rag/services/upsert-rag-sources.ts`（**最重要**。既存の source_type の語彙と、
  どのタイミングで upsert されるかを把握する）
- `src/features/rag/services/retrieve-rag-context.ts`（検索パラメータ）
- `src/features/rules/services/rule-review-service.ts`（RAG を prompt に入れる既存の作法）
- `docs/rag.md`（「RAG は参照であり現在の入力を優先する」原則）
- `src/app/api/privacy/delete/rag-memory/route.ts`（削除対象の管理方法）

## やらないこと

- 外部知識（Web・ニュース原文・IR 資料全文）の RAG 化。
  ニュースは通知パイプライン（計画 08）で処理する。RAG に入れるのは
  「そのニュースに対してユーザー/AI がどう判断したか」だけ
- 全ユーザー共有コーパス（用語集の RAG 化など）。既存 RAG はユーザー所有前提で
  設計されており、共有データを混ぜると所有権チェックの前提が崩れる。
  用語解説は RAG ではなく既存 glossary 機能の直接参照で足りる
- ベクトル DB の導入（既存の SQLite 保存 + 類似度計算の仕組みを変えない）

## 実装ステップ

### ステップ 1: 新しい source_type を 3 種追加

ファイル: `src/features/rag/services/upsert-rag-sources.ts`（変更）と
`build-rag-document.ts`（変更）

既存の source_type 語彙に追加する（既存の命名規則を確認して合わせる）:

| source_type | 元データ | 文書化する内容 | upsert タイミング |
|-------------|---------|---------------|------------------|
| `alert_resolution` | `rule_alert_events`（計画 06） | 「{date} {ticker} の {condition} 成立に対し、ユーザーは {kept/revising} を選んだ」 | 通知への応答時 |
| `news_assessment` | `news_assessments`（計画 08） | 「{date} {ticker}: {title} は仮説『{thesis の先頭 100 字}』に {supports/challenges} と判定。要約: {summary}」 | assessment 保存時 |
| `holistic_review` | `holistic_reviews`（計画 09） | 月次レビューの findings を 1 finding = 1 チャンク相当の文で | レビュー生成時 |

- 文書化テンプレートは各計画のサービス内ではなく `build-rag-document.ts` に集約する
  （RAG 文書の形式を 1 箇所で管理するため）。
- `reindex-user-rag-documents.ts` に新 source_type の再構築を追加する
  （リインデックス漏れがあると削除済みデータが検索に残り続ける）。
- **プライバシー**: `/api/privacy/delete/rag-memory` の削除対象に新 source_type を追加する。
  これを忘れると「削除したはずの判断記録が AI の参照に残る」事故になる。必ずテストを書く。

### ステップ 2: ルールレビューへの判断履歴の注入（既存利用箇所の強化）

ファイル: `src/features/rules/services/rule-review-service.ts`（変更）

- 既存の `retrieveRagContext` 呼び出しの `sourceTypes` に `alert_resolution` を追加し、
  queryText にセッションの ticker を含める。
- プロンプトに追加する指示: 「参照情報にユーザーの過去の判断記録が含まれる場合、
  今回のルールとの一貫性（例: 前回は -15% で見直すと決めたのに今回は -30% になっている）に
  気づいたら指摘する。ただし過去に従えとは言わない」。

### ステップ 3: 仮説下書きへの過去仮説の注入（計画 04 の強化）

ファイル: `src/features/rules/services/thesis-draft-service.ts`（計画 04 の成果物。変更）

- `generateThesisDraft` の冒頭で検索する:

```ts
const ragResult = await retrieveRagContext({
  userId: params.userId,
  taskType: "rule_generation",   // 既存の taskType 語彙を確認して合わせる
  queryText: `${ticker} ${companyName} 投資仮説`,
  sourceTypes: ["rule", "alert_resolution", "holistic_review"],  // "rule" は既存語彙を確認
  maxContextChars: 1500,   // 下書き生成は light な用途なので小さく絞る
});
```

- プロンプトに「ユーザーが過去に似た銘柄で書いた仮説・判断」として渡し、
  文体と一貫性の参考にさせる。**過去の仮説の複製は禁止**と指示する。
- 検索結果が 0 件でもエラーにしない（新規ユーザーは必ず 0 件。これは欠損ではなく正常系。
  その旨をコメントに書く）。

### ステップ 4: ニュース分類への過去判定の注入（計画 08 の強化）

ファイル: 計画 08 の分類処理（変更）

- 同一 ticker の直近 `news_assessments` を RAG 経由（sourceTypes: `news_assessment`、
  maxContextChars: 1000）で 2〜3 件取り、分類プロンプトに
  「このユーザーの仮説に対する過去の判定例」として渡す。
- 目的は判定の一貫性（同種のニュースで supports / challenges が揺れない）。
- コスト注意: 分類は件数が多いので、この注入で入力トークンが増えすぎないよう
  `maxContextChars` を必ず 1000 以下にする（コメントで理由を書く）。
  埋め込み検索自体のコストは分類 LLM より桁で小さいが、`ai_run_logs` には記録される
  （既存の embedding 呼び出しの記録方法を確認し、漏れていれば揃える）。

### ステップ 5: 月次レビューへの前月比較の注入（計画 09 の強化）

ファイル: `holistic-review-service.ts`（計画 09 の成果物。変更）

- 前月の `holistic_reviews.review_json` を**RAG ではなく直接取得**して
  （period で引けるので検索不要。RAG を使わない理由をコメントに書く）、
  プロンプトに「前月の指摘」を渡す。
- 出力スキーマに `changedFromLastMonth: z.string().max(300).optional()` を追加し、
  画面に「前月からの変化」として表示する（例: 「先月指摘した出口ルール未設定の
  2 銘柄のうち 1 銘柄は設定済みになりました」）。
- `alert_resolution` は RAG で取得して「今月のあなたの判断」として渡す
  （こちらは件数が不定なので検索が適する）。

### ステップ 6: 表示原則

RAG 由来の内容を AI 出力に含めて表示する場合の共通規約
（`docs/rag.md` に追記し、各画面で守る）:

- 出所を明示する: 「あなたの過去のメモ・判断から」という接頭辞を付ける
- 過去の判断を根拠に売買を促す文にしない（一貫性の**指摘**まで）
- RAG が引いた内容が現在の入力と矛盾する場合は、現在の入力を優先する（既存原則の再確認）

## テスト

置き場所: `tests/features/rag/`（既存フォルダ）

必須ケース:

1. `alert_resolution` の upsert: 計画 06 の応答保存後に RAG 文書が作られ、
   ticker で検索するとヒットする
2. **所有権テスト**: ユーザー A の判断記録がユーザー B の `retrieveRagContext` 結果に
   絶対に混ざらない（sourceTypes 全種で確認）
3. プライバシー削除: rag-memory 削除後、新 source_type 3 種のチャンクが検索から消える
4. リインデックス: `reindex-user-rag-documents` 実行後に新 source_type が再構築される
5. 検索 0 件時に `generateThesisDraft` がエラーにならず通常の下書きを返す
6. 分類プロンプトへの注入が `maxContextChars: 1000` を超えない

## 完了条件

- [ ] 通知応答・ニュース判定・月次レビューが RAG 文書として蓄積される
- [ ] ルールレビューが過去の判断との一貫性を指摘できる（手動確認で 1 例示す）
- [ ] プライバシー削除・リインデックスが新 source_type を含めて動く
- [ ] RAG 由来の表示に「あなたの過去のメモ・判断から」の出所表示が付く
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test` が通る
