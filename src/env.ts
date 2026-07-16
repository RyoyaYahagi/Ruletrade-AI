import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  SQLITE_DATABASE_PATH: z.string().default("./data/ruletrade.sqlite"),
  LOCAL_STORAGE_PATH: z.string().default("./data/storage"),

  AI_PROVIDER: z
    .enum(["mock", "openai", "gemini", "anthropic", "codex-app-server"])
    .default("mock"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_CODEX_MODEL: z.string().optional(),

  CODEX_APP_SERVER_URL: z.string().url().optional(),
  CODEX_APP_SERVER_PORT: z.coerce.number().int().positive().default(8765),
  CODEX_APP_SERVER_MODEL: z.string().default("gpt-5.4-mini"),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),

  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),

  EMBEDDING_PROVIDER: z.enum(["mock", "openai", "gemini"]).default("mock"),

  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

  RAG_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
  RAG_MATCH_COUNT: z.coerce.number().int().positive().default(8),
  RAG_MAX_CONTEXT_CHARS: z.coerce.number().int().positive().default(6000),

  ENABLE_SAFETY_CHECK: z.coerce.boolean().default(true),
  ENABLE_AI_LOGGING: z.coerce.boolean().default(true),
  ENABLE_EVAL_MODE: z.coerce.boolean().default(false),

  AI_LOG_PAYLOADS: z.coerce.boolean().default(false),

  ENABLE_RATE_LIMIT: z.coerce.boolean().default(true),
  ENABLE_COST_LIMIT: z.coerce.boolean().default(true),
  DEFAULT_MONTHLY_AI_COST_LIMIT_USD: z.coerce.number().min(0).default(1),

  CRON_SECRET: z.string().optional(),

  NEWS_PROVIDER: z.enum(["mock", "rss"]).default("mock"),
  NEWS_RSS_FEEDS: z.string().default(""),

  DOCUMENTS_BUCKET: z.string().default("documents"),
  MAX_DOCUMENT_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10485760),
  MAX_EXTRACTED_TEXT_CHARS: z.coerce.number().int().positive().default(100000),

  STRIPE_SECRET_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  DEVELOPMENT_AI_ASSISTANT: z.string().default("codex-sdk"),
});

export const env = EnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,

  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

  SQLITE_DATABASE_PATH: process.env.SQLITE_DATABASE_PATH,
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH,

  AI_PROVIDER: process.env.AI_PROVIDER,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_CODEX_MODEL: process.env.OPENAI_CODEX_MODEL,

  CODEX_APP_SERVER_URL: process.env.CODEX_APP_SERVER_URL,
  CODEX_APP_SERVER_PORT: process.env.CODEX_APP_SERVER_PORT,
  CODEX_APP_SERVER_MODEL: process.env.CODEX_APP_SERVER_MODEL,

  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,

  AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,

  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER,

  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS: process.env.EMBEDDING_DIMENSIONS,

  RAG_MATCH_THRESHOLD: process.env.RAG_MATCH_THRESHOLD,
  RAG_MATCH_COUNT: process.env.RAG_MATCH_COUNT,
  RAG_MAX_CONTEXT_CHARS: process.env.RAG_MAX_CONTEXT_CHARS,

  ENABLE_SAFETY_CHECK: process.env.ENABLE_SAFETY_CHECK,
  ENABLE_AI_LOGGING: process.env.ENABLE_AI_LOGGING,
  ENABLE_EVAL_MODE: process.env.ENABLE_EVAL_MODE,

  AI_LOG_PAYLOADS: process.env.AI_LOG_PAYLOADS,

  ENABLE_RATE_LIMIT: process.env.ENABLE_RATE_LIMIT,
  ENABLE_COST_LIMIT: process.env.ENABLE_COST_LIMIT,
  DEFAULT_MONTHLY_AI_COST_LIMIT_USD:
    process.env.DEFAULT_MONTHLY_AI_COST_LIMIT_USD,

  CRON_SECRET: process.env.CRON_SECRET,

  NEWS_PROVIDER: process.env.NEWS_PROVIDER,
  NEWS_RSS_FEEDS: process.env.NEWS_RSS_FEEDS,

  DOCUMENTS_BUCKET: process.env.DOCUMENTS_BUCKET,
  MAX_DOCUMENT_UPLOAD_BYTES: process.env.MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_EXTRACTED_TEXT_CHARS: process.env.MAX_EXTRACTED_TEXT_CHARS,

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,

  DEVELOPMENT_AI_ASSISTANT: process.env.DEVELOPMENT_AI_ASSISTANT,
});
