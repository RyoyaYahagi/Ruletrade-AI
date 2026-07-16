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
  // 投資信託はコードが表示されない明細もあるため、名称だけでも登録できる。
  // 保存時にはサービス層で内部識別子を補う。
  ticker: z.string().trim().min(1).max(32).optional(),

  companyName: z.string().trim().max(200).optional(),

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
}).superRefine((position, context) => {
  if (position.ticker || position.companyName) return;

  context.addIssue({
    code: "custom",
    path: ["ticker"],
    message: "銘柄コードまたは銘柄名を入力してください。",
  });
});

export const PortfolioPositionBulkSchema = z.object({
  positions: z.array(PortfolioPositionSchema).min(1).max(100),
});

export type PortfolioPosition = z.infer<typeof PortfolioPositionSchema>;
