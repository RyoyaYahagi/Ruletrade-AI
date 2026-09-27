import { z } from "zod";

export const TransactionSideSchema = z.enum(["buy", "sell"]);

export const TransactionSchema = z.object({
  id: z.string().min(1),
  stockId: z.string().min(1),
  side: TransactionSideSchema,
  quantity: z.number().positive(),
  price: z.number().nonnegative().nullable(),
  fee: z.number().nonnegative().nullable(),
  executedAt: z.string().datetime(),
  decisionId: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  priceCurrency: z.enum(["JPY", "USD"]).nullable().optional(),
  feeCurrency: z.enum(["JPY", "USD"]).nullable().optional(),
  settlementDate: z.string().nullable().optional(),
  settlementCurrency: z.enum(["JPY", "USD"]).nullable().optional(),
  settlementAmount: z.number().nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  accountType: z.string().nullable().optional(),
  sourceBroker: z.enum(["rakuten", "sbi", "nomura"]).nullable().optional(),
  sourceTradeType: z.string().nullable().optional(),
  importBatchId: z.string().nullable().optional(),
  sourceFingerprint: z.string().nullable().optional(),
  sourceRowNumber: z.number().int().positive().nullable().optional(),
});

export const TransactionInputSchema = TransactionSchema.omit({
  id: true,
  stockId: true,
  decisionId: true,
  createdAt: true,
  priceCurrency: true,
  feeCurrency: true,
  settlementDate: true,
  settlementCurrency: true,
  settlementAmount: true,
  exchangeRate: true,
  accountType: true,
  sourceBroker: true,
  sourceTradeType: true,
  importBatchId: true,
  sourceFingerprint: true,
  sourceRowNumber: true,
}).extend({ executedAt: z.string().datetime().nullable() });

export const ConfirmedTransactionInputSchema = TransactionInputSchema.extend({
  executedAt: z.string().datetime(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type ConfirmedTransactionInput = z.infer<
  typeof ConfirmedTransactionInputSchema
>;
