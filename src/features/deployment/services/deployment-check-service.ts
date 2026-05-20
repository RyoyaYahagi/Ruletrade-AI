import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function listDeploymentChecks(deploymentRecordId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deployment_checks")
    .select("*")
    .eq("deployment_record_id", deploymentRecordId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("INTERNAL_ERROR", "デプロイチェックの取得に失敗しました。", 500, error);
  }

  return { checks: data ?? [] };
}

export async function updateDeploymentCheck(params: {
  checkId: string;
  status: string;
  evidenceUrl?: string;
  notes?: string;
  checkedBy?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deployment_checks")
    .update({
      status: params.status,
      evidence_url: params.evidenceUrl ?? null,
      notes: params.notes ?? null,
      checked_by: params.checkedBy ?? null,
      checked_at: new Date().toISOString(),
    })
    .eq("id", params.checkId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("INTERNAL_ERROR", "デプロイチェックの更新に失敗しました。", 500, error);
  }

  return { check: data };
}
