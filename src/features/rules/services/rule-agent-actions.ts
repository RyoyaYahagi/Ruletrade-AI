"use server";

import { z } from "zod";
import {
  explainTradingRule,
  evaluateTradingRule,
  generateTradingRule,
  reviewTradingRule,
} from "./rule-agent-service";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import type { InvestmentMemory, TradingRule } from "@/schemas/rules/trading-rule";

const generateInputSchema = z.object({
  userIntent: z.string().min(1),
  memory: z.object({
    riskTolerance: z.enum(["low", "medium", "high"]),
    preferredMarkets: z.array(z.string()),
    timeHorizons: z.array(z.string()),
    rejectedPatterns: z.array(z.string()),
    standingConstraints: z.array(z.string()),
  }).optional(),
});

export async function runRuleGeneration(input: {
  userIntent: string;
  memory?: InvestmentMemory;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "ログインが必要です。" };
  }

  const parsed = generateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", issues: parsed.error.issues };
  }

  try {
    const result = await generateTradingRule(
      parsed.data.userIntent,
      parsed.data.memory,
    );
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Rule generation failed: ${message}` };
  }
}

export async function runRuleReview(input: {
  rule: TradingRule;
  memory?: InvestmentMemory;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "ログインが必要です。" };
  }

  try {
    const result = await reviewTradingRule(input.rule, input.memory);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Rule review failed: ${message}` };
  }
}

export async function runRuleEvaluation(input: {
  rule: TradingRule;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "ログインが必要です。" };
  }

  try {
    const result = await evaluateTradingRule(input.rule);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Rule evaluation failed: ${message}` };
  }
}

export async function runRuleExplanation(input: {
  rule: TradingRule;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "ログインが必要です。" };
  }

  try {
    const result = await explainTradingRule(input.rule);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Rule explanation failed: ${message}` };
  }
}
