import { z } from "zod";

import { TransactionSideSchema } from "@/schemas/transaction";

export const DecisionTypeSchema = z.enum([
  "buy",
  "add",
  "sell_consideration",
  "sell",
  "thesis_update",
  "note",
]);

export const DecisionExtractionSchema = z.object({
  type: DecisionTypeSchema,
  stock: z.object({
    ticker: z.string().trim().min(1).nullable(),
    name: z.string().trim().min(1),
    market: z.string().trim().min(1).nullable(),
  }),
  thesis: z.string().trim().min(1).nullable(),
  assumptions: z.array(z.string().trim().min(1)),
  reviewConditions: z.array(z.string().trim().min(1)),
  addConditions: z.array(z.string().trim().min(1)),
  transaction: z
    .object({
      side: TransactionSideSchema,
      quantity: z.number().positive().nullable(),
      price: z.number().nonnegative().nullable(),
      fee: z.number().nonnegative().nullable(),
      executedAt: z.string().datetime().nullable(),
    })
    .nullable(),
  followUpQuestion: z.string().trim().min(1).max(500).nullable(),
});

const DecisionSnapshotSchema = z.object({
  id: z.string().min(1),
  stockId: z.string().min(1),
  type: DecisionTypeSchema,
  rawInput: z.string().min(1),
  transcript: z.string().nullable(),
  followUpAnswer: z.string().nullable(),
  thesis: z.string().nullable(),
  assumptions: z.array(z.string()),
  reviewConditions: z.array(z.string()),
  addConditions: z.array(z.string()),
  reviewAt: z.string().datetime().nullable(),
  reviewDates: z.array(z.string().datetime()).optional(),
  decidedAt: z.iso.date().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const DecisionSchema = DecisionSnapshotSchema.extend({
  editHistory: z
    .array(
      z.object({
        editedAt: z.string().datetime(),
        previous: DecisionSnapshotSchema,
      }),
    )
    .optional(),
});

export const EditDecisionInputSchema = DecisionSnapshotSchema.pick({
  id: true,
  stockId: true,
  type: true,
  rawInput: true,
  thesis: true,
  assumptions: true,
  reviewConditions: true,
  addConditions: true,
}).extend({
  rawInput: z
    .string()
    .refine((value) => value.trim().length > 0, "本文を入力してください。"),
  decidedAt: z.iso.date(),
  reviewDates: z.array(z.string().datetime()),
  expectedRevision: z.number().int().nonnegative(),
});

export type DecisionType = z.infer<typeof DecisionTypeSchema>;
export type DecisionExtraction = z.infer<typeof DecisionExtractionSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
