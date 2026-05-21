export type AgentRole =
  | "orchestrator"
  | "generator"
  | "risk_reviewer"
  | "evaluator"
  | "explanation_writer";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type WorkflowStep = {
  id: string;
  agentRole: AgentRole;
  status: WorkflowStepStatus;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  modelUsed: string | null;
  costEstimate: number | null;
};

export type AgentWorkflowState = {
  id: string;
  ruleId: string | null;
  steps: WorkflowStep[];
  overallStatus: WorkflowStepStatus;
  createdAt: string;
  updatedAt: string;
};

export const AGENT_ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  orchestrator: "Routes work between agents and manages workflow state",
  generator: "Drafts structured trading rules from user briefs",
  risk_reviewer: "Validates rules for contradictions and safety issues",
  evaluator: "Runs backtests and evaluates rule performance",
  explanation_writer: "Generates natural language summaries",
};

export const DEFAULT_AGENT_WORKFLOW_STEPS: AgentRole[] = [
  "orchestrator",
  "generator",
  "risk_reviewer",
  "evaluator",
  "explanation_writer",
];
