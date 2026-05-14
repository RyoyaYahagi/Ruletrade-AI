import "server-only";
import { z } from "zod";
import { callAi, type TaskWeight } from "../provider-gateway";
import { buildSubAgentPrompt } from "./prompts";
import type {
  InvestigationOutput,
  InvestigationSummary,
  SubAgentDispatchOptions,
  SubAgentRole,
  SummaryOutput,
} from "./types";

const investigationSchema = z.object({
  missingInfo: z.array(z.string()),
  relevantContext: z.array(z.string()),
  suggestedQueries: z.array(z.string()),
});

const summarySchema = z.object({
  summary: z.string(),
  keyFacts: z.array(z.string()),
  gapsRemaining: z.array(z.string()),
});

function weightForRole(role: SubAgentRole): TaskWeight {
  switch (role) {
    case "investigator":
      return "light";
    case "summarizer":
      return "light";
    case "rule_generator":
      return "standard";
    case "risk_reviewer":
      return "standard";
    case "backtest_evaluator":
      return "standard";
    case "explanation_writer":
      return "light";
    default:
      return "standard";
  }
}

export async function dispatchSubAgent<TInput, TOutput>(
  options: SubAgentDispatchOptions<TInput, TOutput>
): Promise<
  | {
      ok: true;
      data: TOutput;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
  | { ok: false; error: string }
> {
  const { system, prompt } = buildSubAgentPrompt({
    role: options.task.role,
    instruction: options.task.instruction,
    context: options.task.context,
  });

  const result = await callAi({
    system: options.system ?? system,
    prompt,
    weight: options.weight,
    outputSchema: options.outputSchema,
    temperature: options.temperature,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    data: result.data,
    usage: result.usage,
  };
}

export async function runInvestigator<TContext>(
  instruction: string,
  context: TContext
): Promise<
  | {
      ok: true;
      data: InvestigationOutput;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
  | { ok: false; error: string }
> {
  return dispatchSubAgent({
    task: {
      role: "investigator",
      instruction,
      context: context as Record<string, unknown>,
    },
    weight: weightForRole("investigator"),
    outputSchema: investigationSchema,
  });
}

export async function runSummarizer(
  investigationResult: InvestigationOutput
): Promise<
  | {
      ok: true;
      data: SummaryOutput;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
  | { ok: false; error: string }
> {
  return dispatchSubAgent({
    task: {
      role: "summarizer",
      instruction:
        "Summarize the investigation results into a concise brief for downstream agents. Preserve uncertainty and flag remaining gaps.",
      context: investigationResult as unknown as Record<string, unknown>,
    },
    weight: weightForRole("summarizer"),
    outputSchema: summarySchema,
  });
}

export async function investigateAndSummarize<TContext>(
  instruction: string,
  context: TContext
): Promise<
  | {
      ok: true;
      data: InvestigationSummary;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }
  | { ok: false; error: string }
> {
  const investigation = await runInvestigator(instruction, context);
  if (!investigation.ok) {
    return { ok: false, error: investigation.error };
  }

  const summary = await runSummarizer(investigation.data);
  if (!summary.ok) {
    return { ok: false, error: summary.error };
  }

  return {
    ok: true,
    data: {
      investigation: investigation.data,
      summary: summary.data,
    },
    usage: {
      promptTokens:
        investigation.usage.promptTokens + summary.usage.promptTokens,
      completionTokens:
        investigation.usage.completionTokens + summary.usage.completionTokens,
      totalTokens: investigation.usage.totalTokens + summary.usage.totalTokens,
    },
  };
}
