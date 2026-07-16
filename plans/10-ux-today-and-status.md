# 10. Today 画面・状態バッジ・タイポグラフィ改善

## 目的

「文字が多い・小さい」という現状の UX 課題を解消する。方針は**読ませない、状態を見せる**。

1. **状態バッジの言語を導入**: 銘柄・ルール・通知を 3 状態（緑=ルール内 / 黄=要確認 / 赤=条件成立）で
   統一表現する。一覧画面は色とバッジだけで把握できる。
2. **Today 画面**: 開いたら「今日確認すべきこと」だけがカードで並ぶ。
   ゼロ件なら「今日は確認することがありません」を大きく表示する
   （「何もしない」を肯定するのはこの製品の核心体験）。
3. **タイポグラフィスケール**: 本文最低 16px、数値は大きく、文章は畳む。

## 依存関係

- 計画 06（`rule_alert_events` と 3 状態の定義元データ）が先。
- 計画 04・07・08・09 の画面がこの計画のコンポーネントを使うため、
  それらと並行する場合はこの計画のステップ 1〜2 を先に切り出してもよい。

## 最初に読むファイル

- `docs/design-system.md` と `docs/ux-guidelines.md`（既存の設計原則。矛盾しないこと）
- `src/app/globals.css` または Tailwind 設定（既存のタイポ定義を確認）
- `src/components/` 配下の共有 UI コンポーネント（既存の Card / Badge の有無を確認。
  `components.json` があるので shadcn/ui ベースの可能性が高い。あるものを使う）
- `src/app/dashboard/page.tsx`（既存ダッシュボードとの関係を確認）
- `src/features/notifications/components/notification-bell.tsx`

## やらないこと

- 全画面の一斉リデザイン（対象は新規コンポーネント + Today 画面 + ルール/ポートフォリオ一覧のみ）
- ダークモード対応の変更（既存の挙動を維持）
- 既存ダッシュボードの削除（Today はダッシュボードを置き換えない。役割が違う:
  Today = 今日の確認事項、ダッシュボード = 全体俯瞰）

## 実装ステップ

### ステップ 1: 状態の定義（データ層）

ファイル: `src/features/ux/services/attention-status-service.ts`（新規。
`src/features/ux/` は既存フォルダ）

3 状態の決定ロジックを 1 箇所に集約する:

```ts
export type AttentionStatus = "on_track" | "needs_check" | "condition_met";

// ルールセッション単位の状態
export async function getRuleAttentionStatus(params: {
  userId: string;
  sessionId: string;
}): Promise<AttentionStatus>;

// ユーザーの全銘柄分を一括取得（一覧画面用・N+1禁止）
export async function listAttentionStatuses(params: {
  userId: string;
}): Promise<Map<string, AttentionStatus>>;
```

判定規則（上から優先）:

| 状態 | 条件 |
|------|------|
| `condition_met`（赤） | 未解決の `rule_alert_events`（resolution 未設定）または未読の `news_thesis_impact` 通知がある |
| `needs_check`（黄） | 品質チェックに warning がある / レビュー周期を過ぎている / 質問が pending / 価格が stale |
| `on_track`（緑） | 上記いずれもない |

### ステップ 2: 共有 UI コンポーネント

ファイル: `src/components/status/attention-badge.tsx`（新規）

- 3 状態のバッジ。色 + アイコン + 短いラベル（「ルール内」「要確認」「条件成立」）。
  **色だけに頼らない**（色覚対応。既存の accessibility 設定と整合させる）。
- サイズ 2 種（一覧用 sm / 詳細ヘッダ用 md）。

ファイル: `src/components/status/stat-value.tsx`（新規）

- 数値表示の統一コンポーネント。金額・％を `text-xl`（20px）以上・タブラー数字で表示し、
  ラベルを `text-sm` で上に置く。増減は符号 + 色 + 矢印アイコン。

ファイル: `src/components/status/collapsible-detail.tsx`（新規）

- 「要約 1 行 → タップで詳細」の折りたたみ。長文をデフォルトで見せないための共通部品。

### ステップ 3: タイポグラフィスケール

- Tailwind 設定（または `globals.css` のカスタムプロパティ）に定義を追加:
  本文 16px / 補足 14px（最小。12px は数値ラベル等の限定用途のみ）/
  見出し 20・24px / 数値強調 20・28px。行間は本文 1.7。
- `docs/design-system.md` にスケール表を追記する。
- 既存画面の一括置換はしない。**このスケールに反する新規コードを書かない**ことと、
  ステップ 4〜5 で触る画面だけ適用する。

### ステップ 4: Today 画面

ファイル: `src/app/today/page.tsx`（新規）+
`src/features/ux/components/today-feed.tsx`（新規）

API: `src/app/api/today/route.ts`（新規、GET）。以下を 1 レスポンスに集約
（フロントから複数 API を叩かせない）:

```json
{
  "items": [
    { "kind": "alert",        "status": "condition_met", "title": "...", "href": "...", "createdAt": "..." },
    { "kind": "news",         "status": "condition_met", "title": "...", "href": "..." },
    { "kind": "review_due",   "status": "needs_check",   "title": "...", "href": "..." },
    { "kind": "pending_question", "status": "needs_check", "title": "...", "href": "..." },
    { "kind": "monthly_review", "status": "needs_check", "title": "...", "href": "..." }
  ],
  "stats": { "positionsCount": 5, "rulesApproved": 3, "rulesNeedingCheck": 1 }
}
```

- 集約元: 未解決 `rule_alert_events` / 未読通知 / pending 質問 / レビュー期限超過 /
  未読の月次レビュー。すべて `.eq("user_id", ...)`。
- 表示順: `condition_met` → `needs_check`、各グループ内は新しい順。
- **ゼロ件時**: 「今日は確認することがありません。」を画面中央に大きく表示し、
  下に小さく「ルールを守って何もしない日は、良い日です。」と添える。
- 各カード: AttentionBadge + タイトル 1 行 + 遷移先。詳細は遷移先で見せる（カードに詰め込まない）。
- ナビゲーション（既存のヘッダ/サイドバー）に Today へのリンクを追加し、
  ログイン後のデフォルト遷移先を Today に変更する（既存のリダイレクト先を確認して変更）。

### ステップ 5: 一覧画面へのバッジ適用

- ルール一覧（`src/app/rules/` の一覧ページ）: 各行に AttentionBadge。
  `listAttentionStatuses` で一括取得（行ごとに API を叩かない）。
- ポートフォリオ一覧（`src/app/portfolio/`）: 各ポジション行にバッジ +
  評価額を `stat-value` で表示 + 価格 as-of/stale 表示（計画 02）と統合。

## テスト

置き場所: `tests/features/ux/`（新規）と E2E

必須ケース:

1. 判定規則: 未解決アラートあり → `condition_met` / 警告のみ → `needs_check` / 何もなし → `on_track`
2. 優先順位: アラートと警告が両方あるとき `condition_met` が勝つ
3. today API: 他ユーザーの項目が混ざらない（**所有権テスト**）
4. today API: ゼロ件時に `items: []` を返す（エラーにならない）
5. `listAttentionStatuses` が N+1 クエリにならない（呼び出し回数をモックで検証、または実装を一括クエリで書いたことをレビューで確認）

E2E:

6. アラートのあるユーザーで Today に赤カードが表示され、タップでルール詳細に遷移する
7. 確認事項ゼロのユーザーで「今日は確認することがありません。」が表示される

## 完了条件

- [ ] Today 画面が確認事項の有無どちらでも成立している
- [ ] ルール一覧・ポートフォリオ一覧にバッジが付き、状態が一目でわかる
- [ ] 新規画面の本文が 16px 以上で、長文がデフォルトで折りたたまれている
- [ ] タイポスケールが `docs/design-system.md` に記載されている
- [ ] 上記テストがすべて通り、`npm run typecheck && npm run lint && npm run test && npm run test:e2e` が通る
