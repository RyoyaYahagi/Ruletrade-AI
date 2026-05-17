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

export const TradeRuleSchema = z.object({
  investmentThesis: z.string().max(4000).optional(),
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
