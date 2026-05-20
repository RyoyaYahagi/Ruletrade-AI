# Threat Model

## Data Flow

```
Browser → HTTPS → Next.js Server → Supabase (Auth/DB/Storage)
                       ↓
                  AI Provider (OpenAI/Gemini)
```

## Assets

| Asset               | Sensitivity | Location                         |
| ------------------- | ----------- | -------------------------------- |
| Auth tokens         | High        | Supabase Auth + httpOnly cookie  |
| Investment rules    | High        | Supabase DB (RLS)                |
| Portfolio positions | High        | Supabase DB (RLS)                |
| Upload documents    | Medium      | Supabase Storage (bucket policy) |
| RAG chunks          | Medium      | Supabase DB (RLS)                |
| AI run logs         | Medium      | Supabase DB (RLS)                |
| API keys            | Critical    | Server env only                  |

## Threats by Category

### Web App

- Broken Access Control: Mitigated by RLS + requireUser()
- Injection: Mitigated by Zod validation + parameterized queries
- XSS: Mitigated by React escaping + no dangerouslySetInnerHTML
- CSRF: Mitigated by SameSite cookies + stateless API design

### AI

- Prompt Injection: Mitigated by Safety Check + output validation
- Excessive Agency: Mitigated by no tool execution from AI output
- Unbounded Consumption: Mitigated by rate limit + cost limit
- Sensitive Info Disclosure: Mitigated by no PII in prompts

### RAG

- Context Injection: Mitigated by user_id filter
- Embedding Leakage: Mitigated by RLS on rag_chunks
- Unauthorized Retrieval: Mitigated by similarity threshold + user filter

### Storage

- Unauthorized Access: Mitigated by bucket policy (user_id prefix)
- Malicious Upload: Mitigated by MIME check + size limit
- Path Traversal: Mitigated by Supabase Storage path validation

## Risk Acceptance

MVP では以下を許容する：

- 外部ペネトレーションテストなし
- SOC2/ISO27001 未取得
- WAF なし（Vercel + Supabase のデフォルト保護に依存）
- 手動セキュリティレビュー
