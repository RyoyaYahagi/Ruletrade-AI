import { z } from "zod";

export const RiskToleranceSchema = z.enum([
  "conservative",
  "moderate",
  "aggressive",
]);

export const PreferredMarketSchema = z.object({
  market: z.string().min(1).max(100),
  weight: z.number().min(0).max(1).optional(),
});

export const TimeHorizonSchema = z.object({
  horizon: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const RejectedPatternSchema = z.object({
  pattern: z.string().min(1).max(500),
  reason: z.string().max(1000).optional(),
});

export const StandingConstraintSchema = z.object({
  constraint: z.string().min(1).max(500),
  appliesTo: z.array(z.string()).optional(),
});

export const UpsertInvestmentMemoryRequestSchema = z.object({
  riskTolerance: RiskToleranceSchema.optional(),
  preferredMarkets: z.array(PreferredMarketSchema).default([]),
  timeHorizons: z.array(TimeHorizonSchema).default([]),
  rejectedPatterns: z.array(RejectedPatternSchema).default([]),
  standingConstraints: z.array(StandingConstraintSchema).default([]),
  notes: z.string().max(5000).optional(),
});

export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;
export type PreferredMarket = z.infer<typeof PreferredMarketSchema>;
export type TimeHorizon = z.infer<typeof TimeHorizonSchema>;
export type RejectedPattern = z.infer<typeof RejectedPatternSchema>;
export type StandingConstraint = z.infer<typeof StandingConstraintSchema>;
export type UpsertInvestmentMemoryRequest = z.infer<
  typeof UpsertInvestmentMemoryRequestSchema
>;
