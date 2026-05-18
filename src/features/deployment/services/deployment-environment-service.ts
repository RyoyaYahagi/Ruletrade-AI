import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function listDeploymentEnvironments() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deployment_environments")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError("INTERNAL_ERROR", "環境一覧の取得に失敗しました。", 500, error);
  }

  return { environments: data ?? [] };
}

export async function getDeploymentEnvironmentByKey(key: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deployment_environments")
    .select("*")
    .eq("environment_key", key)
    .single();

  if (error || !data) {
    throw new AppError("NOT_FOUND", "環境が見つかりません。", 404);
  }

  return { environment: data };
}
