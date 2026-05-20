import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function listRollbackRecords(params?: { deploymentRecordId?: string; limit?: number }) {
  const supabase = createAdminClient();
  let query = supabase
    .from("rollback_records")
    .select("*")
    .order("created_at", { ascending: false });

  if (params?.deploymentRecordId) {
    query = query.eq("deployment_record_id", params.deploymentRecordId);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Rollback記録の取得に失敗しました。", 500, error);
  }

  return { records: data ?? [] };
}

export async function createRollbackRecord(params: {
  deploymentRecordId?: string;
  rollbackKey: string;
  rollbackType: string;
  reason: string;
  impactSummary?: string;
  executedBy?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rollback_records")
    .insert({
      deployment_record_id: params.deploymentRecordId ?? null,
      rollback_key: params.rollbackKey,
      rollback_type: params.rollbackType,
      reason: params.reason,
      impact_summary: params.impactSummary ?? null,
      executed_by: params.executedBy ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("INTERNAL_ERROR", "Rollback記録の作成に失敗しました。", 500, error);
  }

  return { record: data };
}
