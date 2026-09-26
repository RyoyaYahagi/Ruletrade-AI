import { z } from "zod";

export const decisionKindSchema = z.enum(["buy", "add", "sell", "review", "note"]);

const optionalShortText = z.string().trim().max(2000).nullable();

export const decisionDraftSchema = z.object({
  ticker: z.string().trim().min(1).max(20).nullable(),
  companyName: z.string().trim().max(120).nullable(),
  kind: decisionKindSchema,
  rawText: z.string().trim().min(1).max(8000),
  thesis: optionalShortText,
  assumptions: z.array(z.string().trim().min(1).max(500)).max(12),
  exitConditions: z.array(z.string().trim().min(1).max(500)).max(12),
  addConditions: z.array(z.string().trim().min(1).max(500)).max(12),
});

export const decisionInputSchema = decisionDraftSchema.extend({
  ticker: z.string().trim().min(1).max(20),
  reviewAt: z.string().date().nullable(),
});

export const transactionInputSchema = z.object({
  stockId: z.string().uuid(),
  side: z.enum(["buy", "sell"]),
  tradedAt: z.string().date(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  fees: z.number().nonnegative().default(0),
  reflection: z.string().trim().max(3000).nullable().default(null),
});

export const reviewInputSchema = z.object({
  currentText: z.string().trim().min(1).max(8000),
});

export const reviewComparisonSchema = z.object({
  summary: z.string().trim().min(1).max(2500),
  unchanged: z.array(z.string().trim().min(1).max(700)).max(12),
  changed: z.array(z.string().trim().min(1).max(700)).max(12),
  unclear: z.array(z.string().trim().min(1).max(700)).max(12),
  question: z.string().trim().max(1000).nullable(),
});

export type DecisionDraft = z.infer<typeof decisionDraftSchema>;
export type DecisionInput = z.infer<typeof decisionInputSchema>;
export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type ReviewComparison = z.infer<typeof reviewComparisonSchema>;

export type StockSummary = {
  id: string;
  ticker: string;
  name: string | null;
  position: number;
  latestThesis: string | null;
  updatedAt: string;
};

export type Decision = DecisionInput & {
  id: string;
  stockId: string;
  createdAt: string;
};

export type Transaction = TransactionInput & {
  id: string;
  createdAt: string;
};

export type SavedReview = {
  id: string;
  stockId: string;
  currentText: string;
  comparison: ReviewComparison;
  createdAt: string;
};
