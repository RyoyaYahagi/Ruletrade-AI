import { z } from "zod";

export const BucketSchema = z.enum(["core", "satellite", "unclassified"]);

export type Bucket = z.infer<typeof BucketSchema>;

export const StockSchema = z.object({
  id: z.string().min(1),
  ticker: z.string().nullable(),
  name: z.string().min(1),
  market: z.string().nullable(),
  bucket: BucketSchema.default("unclassified"),
  createdAt: z.string().datetime(),
});

export type Stock = z.infer<typeof StockSchema>;

export const StockBucketChangeSchema = z.object({
  id: z.string().min(1),
  stockId: z.string().min(1),
  fromBucket: BucketSchema,
  toBucket: BucketSchema,
  reason: z.string().nullable(),
  changedAt: z.string().datetime(),
});

export type StockBucketChange = z.infer<typeof StockBucketChangeSchema>;
