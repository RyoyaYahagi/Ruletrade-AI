import { z } from "zod";

export const CreateModelPricingSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  inputCostPer1mTokensUsd: z.number().nonnegative(),
  outputCostPer1mTokensUsd: z.number().nonnegative(),
  effectiveFrom: z.string().min(1),
});
