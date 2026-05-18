import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function listDeploymentRecords(params?: { environmentKey?: string; limit?: number }) {
  const supabase = createAdminClient();
  let query = supabase
    .from("deployment_records")
    .select("*, deployment_environments!inner(environment_key)")
    .order("created_at", { ascending: false });

  if (params?.environmentKey) {
    query = query.eq("deployment_environments.environment_key", params.environmentKey);
  }

  if (params?.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError("INTERNAL_ERROR", "デプロイ記録の取得に失敗しました。", 500, error);
  }

  return { records: data ?? [] };
}

export async function createDeploymentRecord(params: {
  deploymentKey: string;
  environmentId?: string;
  releaseKey?: string;
  version?: string;
  deploymentUrl?: string;
  branchName?: string;
  commitSha?: string;
  pullRequestUrl?: string;
  includesDbMigration?: boolean;
  includesEnvChange?: boolean;
  includesFeatureFlagChange?: boolean;
  metadata?: Record<string, unknown>;
  deployedBy?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("deployment_records")
    .insert({
      deployment_key: params.deploymentKey,
      environment_id: params.environmentId ?? null,
      release_key: params.releaseKey ?? null,
      version: params.version ?? null,
      deployment_url: params.deploymentUrl ?? null,
      branch_name: params.branchName ?? null,
      commit_sha: params.commitSha ?? null,
      pull_request_url: params.pullRequestUrl ?? null,
      includes_db_migration: params.includesDbMigration ?? false,
      includes_env_change: params.includesEnvChange ?? false,
      includes_feature_flag_change: params.includesFeatureFlagChange ?? false,
      metadata: params.metadata ?? {},
      deployed_by: params.deployedBy ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("INTERNAL_ERROR", "デプロイ記録の作成に失敗しました。", 500, error);
  }

  return { record: data };
}
