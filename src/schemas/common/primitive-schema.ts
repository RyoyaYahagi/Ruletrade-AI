import { z } from "zod";

export const UuidSchema = z.string().uuid();

export const TickerSchema = z
  .string()
  .trim()
  .min(1)
  .max(32);

export const CompanyNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(200);

export const CurrencySchema = z.enum(["JPY", "USD", "EUR", "GBP", "OTHER"]);

export const PercentageSchema = z.number().min(0).max(100);

export const NonNegativeNumberSchema = z.number().nonnegative();

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const IsoDateTimeSchema = z.string().datetime();

