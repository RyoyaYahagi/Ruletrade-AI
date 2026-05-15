"use server";

import { z } from "zod";
import {
  createPlan,
  executePlan,
  type WorkflowContext,
} from "./subagent/orchestrator";

const runAgentWorkflowInputSchema = z.object({
  userIntent: z.string().min(1),
  investmentMemory: z
    .object({
      riskTolerance: z.enum(["low", "medium", "high"]),
      preferredMarkets: z.array(z.string()),
      timeHorizons: z.array(z.string()),
      rejectedPatterns: z.array(z.string()),
      standingConstraints: z.array(z.string()),
    })
    .optional(),
  currentRule: z.unknown().optional(),
});

export type RunAgentWorkflowInput = z.infer<typeof runAgentWorkflowInputSchema>;

export async function runAgentWorkflow(input: RunAgentWorkflowInput) {
  const parsed = runAgentWorkflowInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", issues: parsed.error.issues };
  }

  const context: WorkflowContext = {
    userIntent: parsed.data.userIntent,
    investmentMemory: parsed.data.investmentMemory,
    currentRule: parsed.data.currentRule as WorkflowContext["currentRule"],
  };

  const plan = await createPlan(context);
  if (!plan.ok) {
    return { ok: false, error: plan.error };
  }

  const execution = await executePlan(plan.plan, context);
  if (!execution.ok) {
    return { ok: false, error: execution.error };
  }

  return {
    ok: true,
    plan: plan.plan,
    results: execution.results,
    usage: execution.totalUsage,
  };
}
