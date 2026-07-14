import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

export type RuleStateTransition = {
  id: string;
  rule_id: string;
  from_status: string;
  to_status: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CreateRuleStateTransitionInput = {
  rule_id: string;
  from_status: string;
  to_status: string;
  actor_type?: string;
  actor_id?: string | null;
  actor_name?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export type ListRuleStateTransitionsFilters = {
  ruleId?: string;
  limit?: number;
};

export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_review", "blocked", "rejected"],
  in_review: ["blocked", "approved", "rejected", "draft"],
  blocked: ["in_review", "draft", "rejected"],
  approved: [],
  rejected: ["draft"],
};

export function isValidTransition(
  fromStatus: string,
  toStatus: string
): boolean {
  const validNext = VALID_TRANSITIONS[fromStatus] ?? [];
  return validNext.includes(toStatus);
}

export async function recordRuleStateTransition(
  input: CreateRuleStateTransitionInput
) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("rule_state_transitions")
    .insert({
      rule_id: input.rule_id,
      from_status: input.from_status,
      to_status: input.to_status,
      actor_type: input.actor_type ?? "user",
      actor_id: input.actor_id ?? null,
      actor_name: input.actor_name ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error;
  }

  return { data: data as RuleStateTransition };
}

export async function listRuleStateTransitions(
  filters?: ListRuleStateTransitionsFilters
) {
  const db = await createDatabaseClient();

  const limit = Math.min(filters?.limit ?? 50, 100);

  let request = db
    .from("rule_state_transitions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters?.ruleId) {
    request = request.eq("rule_id", filters.ruleId);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return { data: (data ?? []) as RuleStateTransition[] };
}

export async function getRuleAuditTrail(ruleId: string) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("rule_state_transitions")
    .select("*")
    .eq("rule_id", ruleId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return { data: (data ?? []) as RuleStateTransition[] };
}
