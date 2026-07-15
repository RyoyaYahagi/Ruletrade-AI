import { z } from "zod";

export const WatchlistItemStatusSchema = z.enum([
  "watching",
  "researching",
  "rule_designing",
  "ready_for_rule",
  "added_to_portfolio",
  "rejected",
  "archived",
]);

export const WatchlistItemPrioritySchema = z.enum(["low", "medium", "high"]);

export const WatchlistItemSchema = z.object({
  ticker: z.string().min(1).max(32),
  companyName: z.string().max(200).optional(),
  market: z.string().max(50).optional(),
  currency: z.enum(["JPY", "USD", "EUR", "GBP", "OTHER"]).default("JPY"),
  status: WatchlistItemStatusSchema.default("watching"),
  priority: WatchlistItemPrioritySchema.default("medium"),
  interestReason: z.string().max(4000).optional(),
  targetPriceMin: z.number().min(0).optional(),
  targetPriceMax: z.number().min(0).optional(),
  plannedTranches: z.number().int().min(1).max(20).optional(),
  targetMultiple: z.number().positive().optional(),
  maxPositionPercent: z.number().min(0).max(100).optional(),
  stopLossNote: z.string().max(4000).optional(),
  takeProfitNote: z.string().max(4000).optional(),
  earningsNote: z.string().max(4000).optional(),
  researchNotes: z.string().max(8000).optional(),
  tags: z.array(z.string().max(50)).default([]),
  ruleSessionId: z.string().uuid().optional(),
});

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;
