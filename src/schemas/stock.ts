import { z } from "zod";

export const StockSchema = z.object({
  id: z.string().min(1),
  ticker: z.string().nullable(),
  name: z.string().min(1),
  market: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type Stock = z.infer<typeof StockSchema>;
