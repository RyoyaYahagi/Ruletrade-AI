import { z } from "zod";
import { NonNegativeNumberSchema } from "@/schemas/common/primitive-schema";

export const FundsPlanSchema = z.object({
  cashSavings: NonNegativeNumberSchema.default(0),
  monthlyLivingCost: NonNegativeNumberSchema.default(0),
  emergencyFundMonths: z.number().int().min(0).max(120).default(6),
  upcomingExpenses: NonNegativeNumberSchema.default(0),
  plannedDebtRepayment: NonNegativeNumberSchema.default(0),
  monthlyInvestableAmount: NonNegativeNumberSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export type FundsPlan = z.infer<typeof FundsPlanSchema>;
