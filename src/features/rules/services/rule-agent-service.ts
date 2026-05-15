import "server-only";
import {
  dispatchSubAgent,
  investigateAndSummarize,
} from "@/lib/ai/subagent/dispatcher";
import { ruleEvaluationOutputSchema } from "@/schemas/rules/rule-evaluation-schema";
import { ruleExplanationOutputSchema } from "@/schemas/rules/rule-explanation-schema";
import { ruleGenerationOutputSchema } from "@/schemas/rules/rule-generation-schema";
import { ruleReviewOutputSchema } from "@/schemas/rules/rule-review-schema";
import type {
  InvestmentMemory,
  TradingRule,
} from "@/schemas/rules/trading-rule";

export type AgentServiceResult<T> =
  | { ok: true; data: T; investigationSummary?: string }
  | { ok: false; error: string };

export async function generateTradingRule(
  userIntent: string,
  memory?: InvestmentMemory,
  options?: { skipInvestigation?: boolean },
): Promise<
  AgentServiceResult<
    import("@/schemas/rules/rule-generation-schema").RuleGenerationOutput
  >
> {
  const context: Record<string, unknown> = { userIntent, memory };
  let investigationSummary: string | undefined;

  if (!options?.skipInvestigation) {
    const investigation = await investigateAndSummarize(
      "What information is needed to generate a well-specified trading rule from this user intent?",
      context,
    );
    if (!investigation.ok) {
      return { ok: false, error: investigation.error };
    }
    investigationSummary = investigation.data.summary.summary;
    context.investigationSummary = investigation.data.summary;
    context.investigationDetails = investigation.data.investigation;
  }

  const result = await dispatchSubAgent({
    task: {
      role: "rule_generator",
      instruction: `Generate a structured trading rule draft from the following user intent: ${userIntent}`,
      context,
    },
    weight: "standard",
    outputSchema: ruleGenerationOutputSchema,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: result.data,
    investigationSummary,
  };
}

export async function reviewTradingRule(
  rule: TradingRule,
  memory?: InvestmentMemory,
  options?: { skipInvestigation?: boolean },
): Promise<
  AgentServiceResult<
    import("@/schemas/rules/rule-review-schema").RuleReviewOutput
  >
> {
  const context: Record<string, unknown> = { rule, memory };
  let investigationSummary: string | undefined;

  if (!options?.skipInvestigation) {
    const investigation = await investigateAndSummarize(
      "What context or historical patterns could affect the risk assessment of this trading rule?",
      context,
    );
    if (!investigation.ok) {
      return { ok: false, error: investigation.error };
    }
    investigationSummary = investigation.data.summary.summary;
    context.investigationSummary = investigation.data.summary;
    context.investigationDetails = investigation.data.investigation;
  }

  const result = await dispatchSubAgent({
    task: {
      role: "risk_reviewer",
      instruction:
        "Review the provided trading rule for safety issues. Detect missing exits, missing position sizing, contradictions, future data leakage, and overfitting risk.",
      context,
    },
    weight: "standard",
    outputSchema: ruleReviewOutputSchema,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: result.data,
    investigationSummary,
  };
}

export async function evaluateTradingRule(
  rule: TradingRule,
  options?: { skipInvestigation?: boolean },
): Promise<
  AgentServiceResult<
    import("@/schemas/rules/rule-evaluation-schema").RuleEvaluationOutput
  >
> {
  const context: Record<string, unknown> = { rule };
  let investigationSummary: string | undefined;

  if (!options?.skipInvestigation) {
    const investigation = await investigateAndSummarize(
      "What evidence should be gathered or estimated to evaluate this trading rule fairly?",
      context,
    );
    if (!investigation.ok) {
      return { ok: false, error: investigation.error };
    }
    investigationSummary = investigation.data.summary.summary;
    context.investigationSummary = investigation.data.summary;
    context.investigationDetails = investigation.data.investigation;
  }

  const result = await dispatchSubAgent({
    task: {
      role: "backtest_evaluator",
      instruction:
        "Evaluate the trading rule and record backtest evidence. Be honest about missing data and limitations.",
      context,
    },
    weight: "standard",
    outputSchema: ruleEvaluationOutputSchema,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: result.data,
    investigationSummary,
  };
}

export async function explainTradingRule(
  rule: TradingRule,
  options?: { skipInvestigation?: boolean },
): Promise<
  AgentServiceResult<
    import("@/schemas/rules/rule-explanation-schema").RuleExplanationOutput
  >
> {
  const context: Record<string, unknown> = { rule };
  let investigationSummary: string | undefined;

  if (!options?.skipInvestigation) {
    const investigation = await investigateAndSummarize(
      "What aspects of this trading rule should be highlighted for user review and approval?",
      context,
    );
    if (!investigation.ok) {
      return { ok: false, error: investigation.error };
    }
    investigationSummary = investigation.data.summary.summary;
    context.investigationSummary = investigation.data.summary;
    context.investigationDetails = investigation.data.investigation;
  }

  const result = await dispatchSubAgent({
    task: {
      role: "explanation_writer",
      instruction:
        "Write a user-facing explanation of the trading rule for review. Summarize the rule, key risks, evidence, and unresolved blockers.",
      context,
    },
    weight: "light",
    outputSchema: ruleExplanationOutputSchema,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: result.data,
    investigationSummary,
  };
}
