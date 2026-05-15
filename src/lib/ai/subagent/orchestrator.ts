import "server-only";
import { z } from "zod";
import type {
  TradingRule,
  InvestmentMemory,
  RuleWarning,
} from "@/schemas/rules/trading-rule";
import { callAi, type TaskWeight } from "../provider-gateway";
import { dispatchSubAgent, investigateAndSummarize } from "./dispatcher";
import { buildSubAgentPrompt } from "./prompts";
import type { SubAgentRole, SummaryOutput } from "./types";

export type WorkflowContext = {
  userIntent: string;
  investmentMemory?: InvestmentMemory;
  currentRule?: TradingRule;
  priorWarnings?: RuleWarning[];
};

export type AgentPlanStep = {
  role: SubAgentRole;
  instruction: string;
  weight: TaskWeight;
  needsInvestigation: boolean;
};

export type OrchestratorPlan = {
  steps: AgentPlanStep[];
  reasoning: string;
};

const planSchema = z.object({
  steps: z.array(
    z.object({
      role: z.enum([
        "investigator",
        "summarizer",
        "rule_generator",
        "risk_reviewer",
        "backtest_evaluator",
        "explanation_writer",
      ]),
      instruction: z.string(),
      weight: z.enum(["light", "standard", "heavy"]),
      needsInvestigation: z.boolean(),
    }),
  ),
  reasoning: z.string(),
});

export async function createPlan(
  context: WorkflowContext,
): Promise<
  | {
      ok: true;
      plan: OrchestratorPlan;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
  | { ok: false; error: string }
> {
  const { system, prompt } = buildSubAgentPrompt({
    role: "orchestrator" as SubAgentRole,
    instruction:
      "Create an execution plan for the user's request. Determine which sub-agents to call, in what order, and whether each step needs prior investigation. Prefer light-weight models for simple tasks to save tokens.",
    context,
  });

  const result = await callAi({
    system,
    prompt,
    weight: "light",
    outputSchema: planSchema,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    plan: result.data,
    usage: result.usage,
  };
}

export type StepResult = {
  role: SubAgentRole;
  instruction: string;
  investigation?: SummaryOutput;
  output: unknown;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export async function executePlan(
  plan: OrchestratorPlan,
  context: WorkflowContext,
): Promise<
  | {
      ok: true;
      results: StepResult[];
      totalUsage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
  | { ok: false; error: string }
> {
  const results: StepResult[] = [];
  let totalPrompt = 0;
  let totalCompletion = 0;

  for (const step of plan.steps) {
    let investigationSummary: SummaryOutput | undefined;
    let stepContext: Record<string, unknown> = { ...context };

    if (step.needsInvestigation) {
      const investigation = await investigateAndSummarize(
        step.instruction,
        stepContext,
      );
      if (!investigation.ok) {
        return {
          ok: false,
          error: `Investigation failed for step ${step.role}: ${investigation.error}`,
        };
      }
      investigationSummary = investigation.data.summary;
      stepContext = {
        ...stepContext,
        investigationSummary: investigation.data.summary,
        investigationDetails: investigation.data.investigation,
      };
      totalPrompt += investigation.usage.promptTokens;
      totalCompletion += investigation.usage.completionTokens;
    }

    const stepResult = await dispatchSubAgent({
      task: {
        role: step.role,
        instruction: step.instruction,
        context: stepContext,
      },
      weight: step.weight,
      outputSchema: z.object({ result: z.unknown() }),
    });

    if (!stepResult.ok) {
      return {
        ok: false,
        error: `Step ${step.role} failed: ${stepResult.error}`,
      };
    }

    results.push({
      role: step.role,
      instruction: step.instruction,
      investigation: investigationSummary,
      output: stepResult.data.result,
      usage: stepResult.usage,
    });

    totalPrompt += stepResult.usage.promptTokens;
    totalCompletion += stepResult.usage.completionTokens;
  }

  return {
    ok: true,
    results,
    totalUsage: {
      promptTokens: totalPrompt,
      completionTokens: totalCompletion,
      totalTokens: totalPrompt + totalCompletion,
    },
  };
}
