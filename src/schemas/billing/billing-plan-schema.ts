import { z } from "zod";

export const BillingPlanSlugSchema = z.enum(["free", "starter", "pro"]);

export const BillingPlanSchema = z.object({
  id: z.string().uuid(),
  slug: BillingPlanSlugSchema,
  name: z.string(),
  description: z.string().optional(),
  monthlyAiReviews: z.number().int(),
  monthlyDocumentUploads: z.number().int(),
  monthlyRagIndexings: z.number().int(),
  monthlyEmbeddingRequests: z.number().int(),
  maxPortfolios: z.number().int(),
  maxWatchlistItems: z.number().int(),
  maxDocuments: z.number().int(),
  maxStorageBytes: z.number().int(),
  priceMonthly: z.number().int().nullable(),
  priceYearly: z.number().int().nullable(),
  isActive: z.boolean(),
});

export type BillingPlan = z.infer<typeof BillingPlanSchema>;
