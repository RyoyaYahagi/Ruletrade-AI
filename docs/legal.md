# Legal / Compliance

## 基本方針

- Ruletrade-AI は投資助言を提供しません
- Ruletrade-AI は売買推奨をしません
- Ruletrade-AI は資産運用を代行しません
- 最終的な投資判断はユーザー自身が行います
- AI の出力は参考情報であり、将来の収益を保証しません

## 禁止表現

AI 出力で禁止する表現：

- 「買うべきです」「売るべきです」
- 「買いです」「売りです」
- 「上がります」「下がります」
- 「利益が出ます」「安全です」
- 「おすすめです」「推奨します」
- 「代わりに判断します」

## 許可表現

- 「買う前に確認すべき項目」
- 「ルールに含めるべき要素」
- 「過去の類似ケース」
- 「確認漏れの可能性」
- 「ユーザー自身の判断が必要です」

## テーブル

- `legal_acceptances` — 利用規約・免責同意履歴
- `compliance_review_logs` — AI 出力コンプライアンス審査ログ
- `legal_notices` — 法務通知（利用規約・プライバシーポリシー等）
- `financial_safety_events` — 金融安全イベント（ブロック記録）

## API

- `GET /api/legal/acceptance` — 同意状況取得
- `PATCH /api/legal/acceptance` — 同意更新
- `GET /api/legal/notices` — 法務通知一覧

## Compliance Gate

`runComplianceGate()` は AI 出力に対して以下を検証します：

1. Safety Check（禁止フレーズ検出）
2. 投資助言表現パターン検出
3. 違反内容のログ記録
4. 安全でない出力のマスク

## 免責

MVP 時点の法務文書はドラフトです。正式公開前に専門家レビューが必要です。
