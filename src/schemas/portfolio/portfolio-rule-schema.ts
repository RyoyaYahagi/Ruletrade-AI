import { z } from "zod";

export const TargetAllocationSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().max(100).optional(),
  targetPercent: z.number().min(0).max(100),
  tolerancePercent: z.number().min(0).max(100).default(5),
});

export const RiskToleranceSchema = z.enum([
  "conservative",
  "balanced",
  "aggressive",
]);

export const PortfolioCommonRuleSchema = z.object({
  riskTolerance: RiskToleranceSchema.optional(),
  maxPositionCount: z.number().int().min(1).max(500).optional(),
  maxPositionPercent: z.number().min(0).max(100).optional(),
  maxSectorPercent: z.number().min(0).max(100).optional(),
  maxThemePercent: z.number().min(0).max(100).optional(),
  maxMarketPercent: z.number().min(0).max(100).optional(),
  minCashPercent: z.number().min(0).max(100).optional(),
  maxSingleTradeLossPercent: z.number().min(0).max(100).optional(),
  excludedAssetTypes: z.array(z.string().min(1).max(50)).max(20).default([]),
  targetAllocations: z.array(TargetAllocationSchema).max(20).default([]),
  notes: z.string().max(4000).optional(),
});

export const PositionCheckRequestSchema = z.object({
  ticker: z.string().min(1).max(32),
  marketValue: z.number().min(0),
  sector: z.string().max(100).optional(),
  theme: z.string().max(100).optional(),
  assetType: z.string().max(50).optional(),
  market: z.string().max(20).optional(),
  fundedFromCash: z.boolean().default(true),
});

export type TargetAllocation = z.infer<typeof TargetAllocationSchema>;
export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;
export type PortfolioCommonRule = z.infer<typeof PortfolioCommonRuleSchema>;
export type PositionCheckRequest = z.infer<typeof PositionCheckRequestSchema>;
