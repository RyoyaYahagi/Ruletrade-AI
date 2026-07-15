import { z } from "zod";
import {
  PortfolioAssetTypeSchema,
  PortfolioMarketSchema,
} from "@/schemas/portfolio/portfolio-position-schema";

const optionalNonNegativeNumber = z.preprocess(
  (value) => {
    if (value === null || value === "") return undefined;
    if (typeof value === "string") {
      const parsed = Number(value.replaceAll(",", ""));
      return Number.isFinite(parsed) ? parsed : value;
    }
    return value;
  },
  z.number().min(0).optional(),
);

export const PortfolioPositionImportItemSchema = z
  .object({
    ticker: z.string().trim().min(1).max(32).optional(),
    companyName: z.string().trim().min(1).max(200).optional(),
    market: PortfolioMarketSchema.default("JP"),
    currency: z.enum(["JPY", "USD", "EUR", "GBP", "OTHER"]).default("JPY"),
    assetType: PortfolioAssetTypeSchema.default("stock"),
    sector: z.string().trim().max(100).optional(),
    theme: z.string().trim().max(100).optional(),
    quantity: optionalNonNegativeNumber,
    averageCost: optionalNonNegativeNumber,
    currentPrice: optionalNonNegativeNumber,
    marketValue: optionalNonNegativeNumber,
    targetWeightPercent: z.preprocess(
      (value) => {
        if (value === null || value === "") return undefined;
        if (typeof value === "string") return Number(value.replaceAll(",", ""));
        return value;
      },
      z.number().min(0).max(100).optional(),
    ),
    memo: z.string().max(4000).optional(),
    confidence: z.enum(["high", "medium", "low"]).default("medium"),
    extractionNote: z.string().max(500).optional(),
  })
  .superRefine((position, context) => {
    if (position.ticker || position.companyName) return;

    context.addIssue({
      code: "custom",
      path: ["companyName"],
      message: "銘柄コードまたは銘柄名が必要です。",
    });
  });

export const PortfolioPositionImageImportSchema = z.object({
  positions: z.array(PortfolioPositionImportItemSchema).max(100),
  notes: z.string().max(2000).optional(),
});

export type PortfolioPositionImportItem = z.infer<
  typeof PortfolioPositionImportItemSchema
>;
