import { z } from "zod";

export const ThesisResearchSourceTypeSchema = z.enum([
  "company_ir",
  "primary",
  "news",
  "user_document",
  "financial_statement",
]);

export const ThesisResearchSourceInputSchema = z.object({
  ticker: z.string().trim().min(1).max(32),
  market: z.string().trim().min(1).max(16).default("JP"),
  sourceType: z.enum(["company_ir", "primary"]),
  url: z.string().url().max(2000),
  title: z.string().trim().min(1).max(300),
  publisher: z.string().trim().min(1).max(200),
  publishedAt: z.string().trim().max(40).nullable().optional(),
});

export const ThesisResearchSourceSchema = z.object({
  ref: z.string().regex(/^S\d+$/),
  sourceType: ThesisResearchSourceTypeSchema,
  url: z.string().url().nullable(),
  title: z.string().min(1).max(300),
  publisher: z.string().min(1).max(200),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
  excerpt: z.string().min(1).max(1600),
  highlightText: z.string().min(1).max(600),
  verified: z.boolean(),
});

export const ThesisDraftEvidenceSchema = z.object({
  sourceRef: z.string().regex(/^S\d+$/),
  quote: z.string().trim().min(1).max(600),
  reason: z.string().trim().min(1).max(300),
});

export const ThesisDraftSegmentSchema = z.object({
  text: z.string().trim().min(1).max(600),
  sourceRefs: z.array(z.string().regex(/^S\d+$/)).max(6),
});

export const ThesisDraftOutputSchema = z.object({
  thesis: z.string().trim().min(1).max(1200),
  thesisSegments: z.array(ThesisDraftSegmentSchema).min(1).max(12),
  evidence: z.array(ThesisDraftEvidenceSchema).max(12),
  growthDefinition: z.string().trim().min(1).max(500),
  growthIndicators: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
  nearTermFactors: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
  invalidationConditions: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
  breakers: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        newsKeywords: z.array(z.string().min(1).max(50)).max(5),
        sourceRefs: z.array(z.string().regex(/^S\d+$/)).max(6),
      }),
    )
    .length(4),
});

export type ThesisResearchSourceType = z.infer<
  typeof ThesisResearchSourceTypeSchema
>;
export type ThesisResearchSourceInput = z.infer<
  typeof ThesisResearchSourceInputSchema
>;
export type ThesisResearchSource = z.infer<typeof ThesisResearchSourceSchema>;
export type ThesisDraftEvidence = z.infer<typeof ThesisDraftEvidenceSchema>;
export type ThesisDraftSegment = z.infer<typeof ThesisDraftSegmentSchema>;
export type ThesisDraftOutput = z.infer<typeof ThesisDraftOutputSchema>;
