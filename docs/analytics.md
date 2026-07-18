# Analytics

## Privacy-safe Event Tracking

Ruletrade-AI tracks product events for improvement purposes only.

通常の分析イベントには次を含めない:

- Ticker symbols or stock names
- Portfolio positions or values
- Document contents
- AI prompts or outputs
- Personal notes or memos

Allowed properties:

- Feature usage counts
- Completion rates
- Error types (without content)
- Session IDs
- Timestamps

## Feature Flags

Feature flags enable gradual rollouts:

- `enabled` — global on/off
- `rollout_percentage` — percentage of users
- `target_plans` — plan-based gating
- `target_roles` — role-based gating

## Feedback

Users can submit feedback:

- Bug reports
- Feature requests
- Usability issues
- Other comments

Feedback is public (anonymized) within the app for voting.

## Tables

- `product_events` — anonymized usage events
- `feature_flags` — feature toggle definitions
- `feature_flag_assignments` — per-user overrides
- `feedback_items` — user feedback
- `feedback_votes` — up/down votes
- `rule_funnel_events` — ルール作成フローの表示・回答・スキップ・完了イベント（30日）
- `rule_ai_trace_records` — 伏字済みAIトレース（許可時のみ30日）
- `rule_analytics_daily` — 本文を含まない日次集計（1年）

## API

- `POST /api/analytics/events` — track product event
- `POST /api/rule-sessions/[sessionId]/engagement` — track question engagement
- `GET /api/admin/rule-analytics` — admin-only funnel metrics
- `GET /api/admin/rule-analytics/traces/[traceId]` — admin-only masked trace
- `GET /api/feedback` — list feedback
- `POST /api/feedback` — create feedback
- `POST /api/feedback/[feedbackId]/vote` — vote on feedback

## AI trace exception

既存の `ai_payload_logging_enabled` がONの場合だけ、回答セットとAI下書きを
専用テーブルへ伏字済みで保存する。OFFの場合は本文を保存せず、ハッシュ・文字数・
モデル・処理結果のみを保存する。トレースの参照は管理者に限定し、設定をOFFに変更
すると保存済み本文も削除する。
