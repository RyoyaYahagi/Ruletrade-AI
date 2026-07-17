import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  KnowledgeArticleSchema,
  KnowledgeArticleUpdateSchema,
  type KnowledgeArticleInput,
  type KnowledgeArticleUpdate,
} from "@/schemas/knowledge/knowledge-article-schema";

export async function createKnowledgeArticle(input: KnowledgeArticleInput) {
  const parsed = KnowledgeArticleSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "解説記事の入力内容を確認してください。", 400, parsed.error.flatten());
  }

  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("knowledge_articles")
    .insert(toDbRow(parsed.data))
    .select("*")
    .single();
  if (error || !data) {
    throw new AppError("DATABASE_ERROR", "解説記事の保存に失敗しました。", 500, error);
  }
  return { article: readArticle(data) };
}

export async function listKnowledgeArticles(params?: { activeOnly?: boolean }) {
  const db = await createDatabaseClient();
  let query = db.from("knowledge_articles").select("*").order("updated_at", { ascending: false });
  if (params?.activeOnly) query = query.eq("is_active", 1);
  const { data, error } = await query;
  if (error) throw new AppError("DATABASE_ERROR", "解説記事の取得に失敗しました。", 500, error);
  return { articles: (data ?? []).map(readArticle) };
}

export async function listActiveArticlesByTopic(topicKey: string) {
  const normalizedKey = topicKey.trim();
  if (!normalizedKey) return { articles: [] };
  const { articles } = await listKnowledgeArticles({ activeOnly: true });
  return {
    articles: articles.filter((article: ReturnType<typeof readArticle>) =>
      article.topicKeys.includes(normalizedKey),
    ),
  };
}

export async function updateKnowledgeArticle(params: {
  articleId: string;
  input: KnowledgeArticleUpdate;
}) {
  const parsed = KnowledgeArticleUpdateSchema.safeParse(params.input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "解説記事の入力内容を確認してください。", 400, parsed.error.flatten());
  }
  const payload = toDbUpdate(parsed.data);
  if (Object.keys(payload).length === 0) {
    throw new AppError("VALIDATION_ERROR", "更新項目がありません。", 400);
  }

  const db = await createDatabaseClient();
  const { error: updateError } = await db
    .from("knowledge_articles")
    .update(payload)
    .eq("id", params.articleId);
  if (updateError) {
    throw new AppError("DATABASE_ERROR", "解説記事の更新に失敗しました。", 500, updateError);
  }
  const { data, error } = await db
    .from("knowledge_articles")
    .select("*")
    .eq("id", params.articleId)
    .single();
  if (error || !data) throw new AppError("NOT_FOUND", "解説記事が見つかりません。", 404);
  return { article: readArticle(data) };
}

export async function deactivateKnowledgeArticle(articleId: string) {
  return updateKnowledgeArticle({ articleId, input: { isActive: false } });
}

function toDbRow(input: KnowledgeArticleInput) {
  return {
    title: input.title,
    body: input.body,
    topic_keys: input.topicKeys,
    author_name: input.authorName,
    source_name: input.sourceName ?? null,
    source_url: input.sourceUrl ?? null,
    license_note: input.licenseNote,
    published_at: input.publishedAt ?? null,
    is_active: input.isActive,
  };
}

function toDbUpdate(input: KnowledgeArticleUpdate) {
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.body !== undefined) update.body = input.body;
  if (input.topicKeys !== undefined) update.topic_keys = input.topicKeys;
  if (input.authorName !== undefined) update.author_name = input.authorName;
  if (input.sourceName !== undefined) update.source_name = input.sourceName;
  if (input.sourceUrl !== undefined) update.source_url = input.sourceUrl;
  if (input.licenseNote !== undefined) update.license_note = input.licenseNote;
  if (input.publishedAt !== undefined) update.published_at = input.publishedAt;
  if (input.isActive !== undefined) update.is_active = input.isActive;
  return update;
}

function readArticle(row: Record<string, unknown>) {
  let topicKeys: string[] = [];
  if (Array.isArray(row.topic_keys)) {
    topicKeys = row.topic_keys.filter((value): value is string => typeof value === "string");
  } else if (typeof row.topic_keys === "string") {
    try {
      const parsed: unknown = JSON.parse(row.topic_keys);
      if (Array.isArray(parsed)) {
        topicKeys = parsed.filter((value): value is string => typeof value === "string");
      }
    } catch {
      throw new AppError("DATABASE_ERROR", "解説記事のトピックキーが壊れています。", 500);
    }
  }
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    topicKeys,
    authorName: String(row.author_name),
    sourceName: row.source_name == null ? null : String(row.source_name),
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    licenseNote: String(row.license_note),
    publishedAt: row.published_at == null ? null : String(row.published_at),
    isActive: row.is_active === true || row.is_active === 1,
    createdAt: row.created_at == null ? null : String(row.created_at),
    updatedAt: row.updated_at == null ? null : String(row.updated_at),
  };
}
