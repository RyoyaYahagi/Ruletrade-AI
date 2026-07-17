import { z } from "zod";

export const FinancialSourceSchema = z.enum(["edinet", "mock", "manual"]);
export const FinancialFiscalPeriodSchema = z
  .string()
  .regex(/^FY\d{4}(Q[1-4])?$/);

export const FinancialStatementSchema = z.object({
  ticker: z.string().min(1).max(32),
  market: z.string().min(1).max(16).default("JP"),
  fiscalPeriod: FinancialFiscalPeriodSchema,
  revenue: z.number().finite().nullable(),
  operatingIncome: z.number().finite().nullable(),
  netIncome: z.number().finite().nullable(),
  eps: z.number().finite().nullable(),
  dividendPerShare: z.number().finite().nullable(),
  equityRatio: z.number().finite().nullable(),
  currency: z.string().min(1).max(8).default("JPY"),
  filedAt: z.string().nullable(),
});

export const ManualFinancialStatementSchema = FinancialStatementSchema;

export type FinancialStatement = z.infer<typeof FinancialStatementSchema>;
export type FinancialSource = z.infer<typeof FinancialSourceSchema>;

export function financialPeriodKey(value: string) {
  const match = /^FY(\d{4})(?:Q([1-4]))?$/.exec(value);
  if (!match) return -1;
  return Number(match[1]) * 10 + Number(match[2] ?? 4);
}
