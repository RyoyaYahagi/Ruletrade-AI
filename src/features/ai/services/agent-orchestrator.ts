import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import {
  AgentRole,
  WorkflowStepStatus,
  AgentWorkflowState,
  WorkflowStep,
  DEFAULT_AGENT_WORKFLOW_STEPS,
} from "@/features/ai/config/agent-workflow-types";
import { resolveAIModelConfig } from "@/features/ai/services/ai-model-router";

export type PersistedWorkflowStep = {
  id: string;
  workflow_id: string;
  agent_role: string;
  status: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  model_used: string | null;
  cost_estimate: number | null;
  created_at: string;
};

export type CreateWorkflowInput = {
  ruleId?: string | null;
  userId: string;
};

export async function createAgentWorkflow(input: CreateWorkflowInput) {
  const supabase = await createServerClient();

  const { data: workflow, error: workflowError } = await supabase
    .from("agent_workflows")
    .insert({
      rule_id: input.ruleId ?? null,
      user_id: input.userId,
      overall_status: "pending",
    })
    .select("*")
    .single();

  if (workflowError || !workflow) {
    throw workflowError;
  }

  // Create default steps
  const stepsToInsert = DEFAULT_AGENT_WORKFLOW_STEPS.map((role, index) => ({
    workflow_id: workflow.id,
    agent_role: role,
    status: index === 0 ? "pending" : "pending",
    input_data: {},
    output_data: null,
    error_message: null,
    started_at: null,
    completed_at: null,
    model_used: null,
    cost_estimate: null,
  }));

  const { data: steps, error: stepsError } = await supabase
    .from("agent_workflow_steps")
    .insert(stepsToInsert)
    .select("*");

  if (stepsError) {
    throw stepsError;
  }

  return {
    data: {
      workflow: workflow as AgentWorkflowState,
      steps: (steps ?? []) as PersistedWorkflowStep[],
    },
  };
}

export async function getWorkflowById(id: string) {
  const supabase = await createServerClient();

  const { data: workflow, error: workflowError } = await supabase
    .from("agent_workflows")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (workflowError) {
    throw workflowError;
  }

  const { data: steps, error: stepsError } = await supabase
    .from("agent_workflow_steps")
    .select("*")
    .eq("workflow_id", id)
    .order("created_at", { ascending: true });

  if (stepsError) {
    throw stepsError;
  }

  return {
    data: {
      workflow: workflow as AgentWorkflowState | null,
      steps: (steps ?? []) as PersistedWorkflowStep[],
    },
  };
}

export async function updateWorkflowStep(params: {
  stepId: string;
  status: WorkflowStepStatus;
  outputData?: Record<string, unknown> | null;
  errorMessage?: string | null;
  modelUsed?: string | null;
  costEstimate?: number | null;
}) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    status: params.status,
  };

  if (params.outputData !== undefined) {
    payload.output_data = params.outputData;
  }

  if (params.errorMessage !== undefined) {
    payload.error_message = params.errorMessage;
  }

  if (params.modelUsed !== undefined) {
    payload.model_used = params.modelUsed;
  }

  if (params.costEstimate !== undefined) {
    payload.cost_estimate = params.costEstimate;
  }

  if (params.status === "running") {
    payload.started_at = new Date().toISOString();
  }

  if (["completed", "failed", "blocked"].includes(params.status)) {
    payload.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("agent_workflow_steps")
    .update(payload)
    .eq("id", params.stepId)
    .select("*")
    .single();

  if (error || !data) {
    throw error;
  }

  return { data: data as PersistedWorkflowStep };
}

export async function routeStepToAgent(params: {
  workflowId: string;
  agentRole: AgentRole;
  inputData: Record<string, unknown>;
}) {
  // Resolve model config based on agent role
  const taskTypeMap: Record<AgentRole, string> = {
    orchestrator: "rule_orchestration",
    generator: "rule_draft_generation",
    risk_reviewer: "rule_review",
    evaluator: "eval_judge",
    explanation_writer: "rule_explanation",
  };

  const modelConfig = resolveAIModelConfig(taskTypeMap[params.agentRole]);

  // In a real implementation, this would enqueue the task
  // For now, return the model config for the agent to use
  return {
    data: {
      workflowId: params.workflowId,
      agentRole: params.agentRole,
      modelConfig,
      inputData: params.inputData,
    },
  };
}
