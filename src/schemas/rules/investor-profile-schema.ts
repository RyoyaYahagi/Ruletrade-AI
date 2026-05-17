import { z } from "zod";
import { PercentageSchema } from "@/schemas/common/primitive-schema";

export const ExperienceLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

export const InvestmentStyleSchema = z.enum([
  "long_term",
  "swing",
  "dividend",
  "growth",
  "value",
  "mixed",
  "undecided",
]);

export const RiskToleranceSchema = z.enum(["low", "medium", "high", "unknown"]);

export const CashBufferRangeSchema = z.enum([
  "under_100k",
  "100k_500k",
  "500k_1m",
  "1m_3m",
  "over_3m",
  "prefer_not_to_say",
]);

export const PreferredQuestionStyleSchema = z.enum([
  "guided",
  "concise",
  "detailed",
  "bulk_input",
]);

export const InvestorProfileSchema = z.object({
  experienceLevel: ExperienceLevelSchema.default("beginner"),
  investmentStyle: InvestmentStyleSchema.optional(),
  riskTolerance: RiskToleranceSchema.optional(),
  cashBufferRange: CashBufferRangeSchema.optional(),
  maxPositionPercent: PercentageSchema.optional(),
  maxLossPercent: PercentageSchema.optional(),
  preferredQuestionStyle: PreferredQuestionStyleSchema.default("guided"),
  profileJson: z.record(z.string(), z.unknown()).default({}),
});

export type InvestorProfile = z.infer<typeof InvestorProfileSchema>;
