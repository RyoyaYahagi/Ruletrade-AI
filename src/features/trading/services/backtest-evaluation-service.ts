import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export type BacktestEvaluation = {
  id: string;
  rule_id: string;
  status: string;
  test_window_start: string | null;
  test_window_end: string | null;
  sample_size: number | null;
  total_return_percent: number | null;
  annualized_return_percent: number | null;
  max_drawdown_percent: number | null;
  sharpe_ratio: number | null;
  win_rate_percent: number | null;
  confidence_level: number | null;
  confidence_description: string | null;
  known_failure_cases: Array<Record<string, unknown>>;
  limitations: Array<Record<string, unknown>>;
  evaluated_at: string | null;
  evaluated_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateBacktestEvaluationInput = {
  rule_id: string;
  test_window_start?: string | null;
  test_window_end?: string | null;
  sample_size?: number | null;
  total_return_percent?: number | null;
  annualized_return_percent?: number | null;
  max_drawdown_percent?: number | null;
  sharpe_ratio?: number | null;
  win_rate_percent?: number | null;
  confidence_level?: number | null;
  confidence_description?: string | null;
  known_failure_cases?: Array<Record<string, unknown>>;
  limitations?: Array<Record<string, unknown>>;
  evaluated_by?: string | null;
};

export type ListBacktestEvaluationsFilters = {
  ruleId?: string;
  status?: string;
  limit?: number;
};

export async function createBacktestEvaluation(
  input: CreateBacktestEvaluationInput
) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("backtest_evaluations")
    .insert({
      rule_id: input.rule_id,
      test_window_start: input.test_window_start ?? null,
      test_window_end: input.test_window_end ?? null,
      sample_size: input.sample_size ?? null,
      total_return_percent: input.total_return_percent ?? null,
      annualized_return_percent: input.annualized_return_percent ?? null,
      max_drawdown_percent: input.max_drawdown_percent ?? null,
      sharpe_ratio: input.sharpe_ratio ?? null,
      win_rate_percent: input.win_rate_percent ?? null,
      confidence_level: input.confidence_level ?? null,
      confidence_description: input.confidence_description ?? null,
      known_failure_cases: input.known_failure_cases ?? [],
      limitations: input.limitations ?? [],
      evaluated_by: input.evaluated_by ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error;
  }

  return { data: data as BacktestEvaluation };
}

export async function listBacktestEvaluations(
  filters?: ListBacktestEvaluationsFilters
) {
  const supabase = await createServerClient();

  const limit = Math.min(filters?.limit ?? 50, 100);

  let request = supabase
    .from("backtest_evaluations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.ruleId) {
    request = request.eq("rule_id", filters.ruleId);
  }

  if (filters?.status) {
    request = request.eq("status", filters.status);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return { data: (data ?? []) as BacktestEvaluation[] };
}

export async function getBacktestEvaluationById(id: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("backtest_evaluations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return { data: data as BacktestEvaluation | null };
}

export async function updateBacktestEvaluationStatus(params: {
  evaluationId: string;
  status: string;
  actorUserId?: string | null;
}) {
  const supabase = await createServerClient();

  const payload: Record<string, unknown> = {
    status: params.status,
  };

  if (params.status === "completed") {
    payload.evaluated_at = new Date().toISOString();
    payload.evaluated_by = params.actorUserId ?? null;
  }

  const { data, error } = await supabase
    .from("backtest_evaluations")
    .update(payload)
    .eq("id", params.evaluationId)
    .select("*")
    .single();

  if (error || !data) {
    throw error;
  }

  return { data: data as BacktestEvaluation };
}
