import type { z } from "zod";
import type { TaskWeight } from "../provider-gateway";

export type SubAgentRole =
  | "investigator"
  | "summarizer"
  | "rule_generator"
  | "risk_reviewer"
  | "backtest_evaluator"
  | "explanation_writer";

export type SubAgentTask<TInput = Record<string, unknown>> = {
  role: SubAgentRole;
  instruction: string;
  context: TInput;
};

export type InvestigationOutput = {
  missingInfo: string[];
  relevantContext: string[];
  suggestedQueries: string[];
};

export type SummaryOutput = {
  summary: string;
  keyFacts: string[];
  gapsRemaining: string[];
};

export type AgentStructuredOutput<TData> = {
  data: TData;
  reasoning: string;
};

export type SubAgentDispatchOptions<TInput, TOutput> = {
  task: SubAgentTask<TInput>;
  weight: TaskWeight;
  outputSchema: z.ZodType<TOutput>;
  system?: string;
  temperature?: number;
  userId?: string;
};

export type InvestigationSummary = {
  investigation: InvestigationOutput;
  summary: SummaryOutput;
};
