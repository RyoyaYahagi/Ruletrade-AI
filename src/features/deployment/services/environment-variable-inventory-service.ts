import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function listEnvironmentVariableInventory(params?: { environmentKey?: string; missingOnly?: boolean }) {
  const supabase = createAdminClient();
  let query = supabase
    .from("environment_variable_inventory")
    .select("*, deployment_environments!inner(environment_key)")
    .order("variable_key", { ascending: true });

  if (params?.environmentKey) {
    query = query.eq("deployment_environments.environment_key", params.environmentKey);
  }

  if (params?.missingOnly) {
    query = query.eq("is_required", true).eq("is_configured", false);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError("INTERNAL_ERROR", "環境変数一覧の取得に失敗しました。", 500, error);
  }

  return { variables: data ?? [] };
}
