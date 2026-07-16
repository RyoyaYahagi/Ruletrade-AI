import { z } from "zod";

export const PortfolioTargetTypeSchema = z.enum([
  "cash_percent",
  "position_max_percent",
  "position_target_percent",
]);

export const PortfolioTargetInputSchema = z.object({
  portfolioId: z.string().min(1),
  targetType: PortfolioTargetTypeSchema,
  targetKey: z.string().trim().min(1).max(64).nullable().optional(),
  targetPercent: z.number().min(0).max(100),
  tolerancePercent: z.number().min(1).max(20).default(5),
});

export type PortfolioTargetType = z.infer<typeof PortfolioTargetTypeSchema>;
export type PortfolioTargetInput = z.infer<typeof PortfolioTargetInputSchema>;
