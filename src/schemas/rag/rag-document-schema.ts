import { z } from "zod";

export const RagSourceTypeSchema = z.enum([
  "investor_profile",
  "rule_session",
  "rule_version",
  "rule_review",
  "watchlist_item",
  "watchlist_review",
  "portfolio_position",
  "portfolio_review",
  "trade_reflection",
  "manual_note",
]);

export const RagDocumentSchema = z.object({
  sourceType: RagSourceTypeSchema,
  sourceId: z.string().uuid(),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(50000),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RagDocument = z.infer<typeof RagDocumentSchema>;
