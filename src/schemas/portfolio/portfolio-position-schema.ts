import { z } from "zod";

export const PortfolioAssetTypeSchema = z.enum([
  "stock",
  "etf",
  "fund",
  "reit",
  "cash_like",
  "other",
]);

export const PortfolioPositionStatusSchema = z.enum([
  "active",
  "watching",
  "exited",
  "archived",
]);

export const PortfolioMarketSchema = z.enum(["JP", "US", "OTHER"]);

export const PortfolioPositionSchema = z.object({
  ticker: z.string().min(1).max(32),

  companyName: z.string().max(200).optional(),

  market: PortfolioMarketSchema.default("JP"),

  currency: z.enum(["JPY", "USD", "EUR", "GBP", "OTHER"]).default("JPY"),

  assetType: PortfolioAssetTypeSchema.default("stock"),

  sector: z.string().max(100).optional(),

  theme: z.string().max(100).optional(),

  quantity: z.number().min(0).optional(),

  averageCost: z.number().min(0).optional(),

  currentPrice: z.number().min(0).optional(),

  marketValue: z.number().min(0),

  targetWeightPercent: z.number().min(0).max(100).optional(),

  ruleSessionId: z.string().uuid().optional(),

  positionStatus: PortfolioPositionStatusSchema.default("active"),

  memo: z.string().max(4000).optional(),
});

export type PortfolioPosition = z.infer<typeof PortfolioPositionSchema>;
