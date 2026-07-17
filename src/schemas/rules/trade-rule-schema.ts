import { z } from "zod";
import {
  CurrencySchema,
  NonNegativeNumberSchema,
  PercentageSchema,
} from "@/schemas/common/primitive-schema";

export const TimeHorizonSchema = z.enum([
  "short_term",
  "medium_term",
  "long_term",
  "undecided",
]);

export const HoldingPurposeSchema = z.enum([
  "long_term_growth",
  "value",
  "dividend",
  "cyclical",
  "thematic",
  "event_driven",
  "short_term_trade",
  "shareholder_benefit",
  "learning",
  "undecided",
]);

export const ExitTriggerCategorySchema = z.enum([
  "price",
  "volatility",
  "fundamental",
  "time",
]);

export const ExitTriggerActionSchema = z.enum(["sell", "review", "alert"]);

export const ExitTriggerSchema = z.object({
  category: ExitTriggerCategorySchema,
  condition: z.string().min(1).max(1000),
  action: ExitTriggerActionSchema.default("review"),
});

export const EarningsPolicySchema = z.enum([
  "hold_through",
  "avoid_before_earnings",
  "review_before_earnings",
  "undecided",
]);

export const EntryPlanSchema = z.object({
  targetPriceMin: NonNegativeNumberSchema.optional(),
  targetPriceMax: NonNegativeNumberSchema.optional(),
  tranches: z.number().int().min(1).max(20).optional(),
  currency: CurrencySchema.default("JPY"),
  entryConditions: z.array(z.string().min(1).max(1000)).default([]),
});

export const RiskManagementSchema = z.object({
  maxPositionPercent: PercentageSchema.optional(),
  maxPositionAmount: NonNegativeNumberSchema.optional(),
  maxLossPercent: PercentageSchema.optional(),
  stopLossRule: z.string().max(2000).optional(),
  riskNotes: z.array(z.string().min(1).max(1000)).default([]),
});

export const ExitPlanSchema = z.object({
  targetPrice: NonNegativeNumberSchema.optional(),
  targetMultiple: z.number().positive().optional(),
  takeProfitRule: z.string().max(2000).optional(),
  exitConditions: z.array(z.string().min(1).max(1000)).default([]),
});

export const ThesisBreakerSchema = z.object({
  description: z.string().min(1).max(500),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  newsKeywords: z.array(z.string().min(1).max(50)).max(10).default([]),
});

export const ReviewCycleSchema = z.enum([
  "monthly",
  "quarterly",
  "after_earnings",
  "undecided",
]);

export const MonitoringSettingsSchema = z.object({
  stopLossReviewPercent: PercentageSchema.optional(),
  takeProfitReviewPercent: PercentageSchema.optional(),
  drawdownFromHighPercent: PercentageSchema.optional(),
  cooldownDailyDropPercent: PercentageSchema.optional(),
  cooldownHours: z.number().int().min(1).max(168).default(24),
  reviewCycle: ReviewCycleSchema.default("undecided"),
});

export const TradeRuleSchema = z.object({
  investmentThesis: z.string().max(4000).optional(),
  thesisBreakers: z.array(ThesisBreakerSchema).max(10).default([]),
  monitoring: MonitoringSettingsSchema.default({
    cooldownHours: 24,
    reviewCycle: "undecided",
  }),
  purpose: HoldingPurposeSchema.default("undecided"),
  timeHorizon: TimeHorizonSchema.optional(),
  entryPlan: EntryPlanSchema.default({
    currency: "JPY",
    entryConditions: [],
  }),
  riskManagement: RiskManagementSchema.default({
    riskNotes: [],
  }),
  exitPlan: ExitPlanSchema.default({
    exitConditions: [],
  }),
  exitTriggers: z.array(ExitTriggerSchema).max(20).default([]),
  addPositionRule: z.string().max(2000).optional(),
  earningsPolicy: z
    .object({
      policy: EarningsPolicySchema.default("undecided"),
      notes: z.string().max(2000).optional(),
    })
    .default({
      policy: "undecided",
    }),
  portfolioNotes: z.string().max(2000).optional(),
  freeNotes: z.string().max(4000).optional(),
});

export type TradeRule = z.infer<typeof TradeRuleSchema>;
export type ThesisBreaker = z.infer<typeof ThesisBreakerSchema>;
export type MonitoringSettings = z.infer<typeof MonitoringSettingsSchema>;
export type HoldingPurpose = z.infer<typeof HoldingPurposeSchema>;
export type ExitTrigger = z.infer<typeof ExitTriggerSchema>;
