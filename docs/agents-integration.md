# 外部AIエージェント連携

Ruletrade-AIのMCP連携は、ユーザーが自分で決めた投資ルールの閲覧と下書き入力だけを許可します。投資助言・売買推奨・注文実行は行いません。ルールの承認、通知への応答、データ削除、アカウント操作、AI予算変更は外部エージェントに委譲できません。

## 接続手順

1. Web UIの「設定 → 外部エージェント連携」でPATを発行する。
2. 平文トークンを発行直後に安全な場所へ保存する。平文は再表示されない。
3. Streamable HTTPに対応するクライアントから、`https://<host>/api/mcp`へ接続する。
4. リクエストに `Authorization: Bearer rta_<64 hex characters>` を付ける。

Claude Codeの例:

```bash
claude mcp add --transport http ruletrade https://<host>/api/mcp
```

クライアントがヘッダー設定に対応していない場合は、クライアント側の環境変数・シークレット設定でAuthorizationヘッダーを設定する。PATをプロンプトやリポジトリへ貼り付けない。

## 許可されるツール

- read: `list_rule_sessions`, `get_rule_session`, `get_next_question`, `get_portfolio`, `list_watchlist`, `list_notifications`, `get_today_items`, `get_ai_usage_summary`
- read,write: 上記に加えて `create_rule_session`, `answer_question`, `add_watchlist_item`

`answer_question`の入力は、必ず人間から受け取った回答をそのまま渡す。エージェントが不足情報を創作してはならない。保存された回答には`enteredBy: api_agent`が付き、Web UIの完成保存前に本人確認を促す。

## 禁止事項

- finalize / 承認、通知への「維持・見直し」応答、削除、アカウント操作、AI予算変更を代行しない。
- 複数ユーザーのトークンを混在させない。
- 外部エージェントが銘柄について買う・売る等の判断を提示しない。
