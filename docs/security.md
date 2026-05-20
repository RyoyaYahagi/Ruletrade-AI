# Security

## 基本方針

- 認証は Supabase Auth に寄せる
- DB アクセスは RLS でユーザーごとに分離する
- Client から userId を信用しない
- Server 側で requireUser() を必ず通す
- AI Provider API Key を Client に出さない
- AI 出力をそのまま信用しない
- AI 出力は Zod Schema と Safety Check を通す
- RAG 検索は必ず user_id で絞る
- 投資助言・売買推奨は禁止する
- 重要操作は Audit Log に残す

## Threat Model（簡易版）

### Assets

- ユーザー認証情報
- 投資ルール・保有銘柄・購入候補
- アップロード資料
- RAG embeddings
- AI レビュー結果
- AI 実行ログ
- 環境変数・API Key

### Trust Boundaries

1. Browser ↔ Next.js Server（HTTPS）
2. Next.js Server ↔ Supabase（Service Role / Anon Key）
3. Next.js Server ↔ AI Provider（API Key）
4. Supabase Auth ↔ DB（RLS）
5. Supabase Storage（Bucket Policy）

### Top Threats

| #   | Threat                    | Mitigation                            |
| --- | ------------------------- | ------------------------------------- |
| 1   | Broken Access Control     | RLS + requireUser() + owner check     |
| 2   | Prompt Injection          | Safety Check + output validation      |
| 3   | RAG Context Injection     | user_id filter + similarity threshold |
| 4   | Sensitive Data Disclosure | no secrets in NEXT*PUBLIC*            |
| 5   | Secret Leakage            | server-only + no client bundle        |
| 6   | AI Output Over-reliance   | Safety Check + no buy/sell advice     |
| 7   | Cost Abuse                | Rate Limit + Cost Limit               |
| 8   | Improper Error Handling   | sanitized error responses             |
| 9   | File Upload Abuse         | size limit + MIME check               |
| 10  | IDOR                      | user_id check on every query          |

## Security Checklist

### Auth

- [ ] requireUser() on all private routes
- [ ] No userId from client params without verification
- [ ] Session expiration handled

### DB

- [ ] RLS enabled on all user tables
- [ ] Policies restrict to own data only
- [ ] Service Role Key only in server-only files

### API

- [ ] Input validated with Zod
- [ ] Output sanitized
- [ ] Error messages don't leak internals
- [ ] Rate limit enabled

### AI

- [ ] Safety Check on all outputs
- [ ] No system prompt leakage
- [ ] Cost limit configured
- [ ] Mock provider in preview

### RAG

- [ ] user_id filter on match_rag_chunks
- [ ] similarity threshold enforced
- [ ] Document hash verified

### Storage

- [ ] Bucket not public
- [ ] Policies restrict to own prefix
- [ ] File size limit enforced
- [ ] MIME type validated

### Secrets

- [ ] No NEXT*PUBLIC* on secrets
- [ ] .env.local not committed
- [ ] CI uses dummy values

## Production Security Checklist

- [ ] All RLS policies reviewed
- [ ] All API routes have auth
- [ ] AI_PROVIDER is not mock
- [ ] Rate limit enabled
- [ ] Cost limit enabled
- [ ] CRON_SECRET configured
- [ ] No console.log with secrets
- [ ] Error response sanitized
- [ ] Build passes with no new warnings
