import { z } from "zod";

export const KnowledgeArticleSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(100_000),
  topicKeys: z.array(z.string().min(1).max(100)).max(50).default([]),
  authorName: z.string().min(1).max(200),
  sourceName: z.string().max(300).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  licenseNote: z.string().min(1).max(500),
  publishedAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const KnowledgeArticleUpdateSchema = KnowledgeArticleSchema.partial();

export type KnowledgeArticleInput = z.infer<typeof KnowledgeArticleSchema>;
export type KnowledgeArticleUpdate = z.infer<typeof KnowledgeArticleUpdateSchema>;
