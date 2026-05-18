import { z } from "zod";

export const WatchlistSchema = z.object({
  name: z.string().min(1).max(100).default("Main Watchlist"),
  baseCurrency: z.enum(["JPY", "USD", "EUR", "GBP", "OTHER"]).default("JPY"),
  description: z.string().max(2000).optional(),
});

export type Watchlist = z.infer<typeof WatchlistSchema>;
