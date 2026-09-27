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
});

export const TransactionInputSchema = TransactionSchema.omit({
  id: true,
  stockId: true,
  decisionId: true,
  createdAt: true,
}).extend({ executedAt: z.string().datetime().nullable() });

export const ConfirmedTransactionInputSchema = TransactionInputSchema.extend({
  executedAt: z.string().datetime(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type ConfirmedTransactionInput = z.infer<typeof ConfirmedTransactionInputSchema>;
