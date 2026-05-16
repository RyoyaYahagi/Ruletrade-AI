import { z } from "zod";

export const PortfolioSchema = z.object({
  name: z.string().min(1).max(100).default("Main Portfolio"),

  baseCurrency: z.enum(["JPY", "USD", "EUR", "GBP", "OTHER"]).default("JPY"),

  cashAmount: z.number().min(0).default(0),

  notes: z.string().max(4000).optional(),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
