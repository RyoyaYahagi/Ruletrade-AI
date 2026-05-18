import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function listDeploymentMigrationRecords(deploymentRecordId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deployment_migration_records")
    .select("*")
    .eq("deployment_record_id", deploymentRecordId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Migration記録の取得に失敗しました。", 500, error);
  }

  return { records: data ?? [] };
}
