import type { SubAgentRole } from "./types";

function baseSystem(role: SubAgentRole): string {
  const common =
    "You are an AI sub-agent in Ruletrade-AI, a decision-support system for investment rules. " +
    "Your output must be structured JSON. Do not add explanations outside the JSON. " +
    "This is not financial advice.";

  const roleText: Record<SubAgentRole, string> = {
    investigator:
      "Your role is Investigator. Analyze the given task and context, then identify missing information needed to execute the task well. List relevant context already available, missing info, and suggested queries to fill gaps.",
    summarizer:
      "Your role is Summarizer. Condense investigation results into a concise brief that a downstream agent can use immediately. Preserve uncertainty and flag remaining gaps.",
    rule_generator:
      "Your role is Rule Generator. Create a structured trading rule draft from user intent and context. Include entry, exit, risk limits, and assumptions. Mark unresolved info clearly.",
    risk_reviewer:
      "Your role is Risk Reviewer. Critique the structured rule for missing exits, missing position sizing, contradictions, future data leakage, and overfitting risk. Output warnings with severity.",
    backtest_evaluator:
      "Your role is Backtest Evaluator. Record evidence such as backtest window, sample size, drawdown, confidence, and limitations. Do not fabricate results.",
    explanation_writer:
      "Your role is Explanation Writer. Turn structured rule data into plain-language summary for user review. Preserve uncertainty and do not imply approval.",
  };

  return `${common} ${roleText[role]}`;
}

export function buildSubAgentPrompt<TContext>({
  role,
  instruction,
  context,
}: {
  role: SubAgentRole;
  instruction: string;
  context: TContext;
}): { system: string; prompt: string } {
  const system = baseSystem(role);
  const prompt = `Task instruction: ${instruction}

Context:
${JSON.stringify(context, null, 2)}

Respond with valid JSON matching the required schema.`;

  return { system, prompt };
}
