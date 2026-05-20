import "server-only";

import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function evaluateProductionDeploymentGate(params: {
  releaseKey?: string;
  deploymentRecordId?: string;
}) {
  const blockers: string[] = [];

  if (process.env.REQUIRE_QA_GATE_FOR_PRODUCTION === "true") {
    blockers.push("qa_gate_not_implemented");
  }

  if (process.env.REQUIRE_RELEASE_GATE_FOR_PRODUCTION === "true") {
    blockers.push("release_gate_not_implemented");
  }

  if (process.env.REQUIRE_ROLLBACK_PLAN_FOR_PRODUCTION === "true") {
    blockers.push("rollback_plan_not_implemented");
  }

  if (
    process.env.REQUIRE_MIGRATION_RECORD_FOR_PRODUCTION === "true" &&
    params.deploymentRecordId
  ) {
    const supabase = createAdminClient();
    const { data: deployment } = await supabase
      .from("deployment_records")
      .select("includes_db_migration")
      .eq("id", params.deploymentRecordId)
      .maybeSingle();

    if (deployment?.includes_db_migration) {
      const { count } = await supabase
        .from("deployment_migration_records")
        .select("*", { count: "exact", head: true })
        .eq("deployment_record_id", params.deploymentRecordId);

      if ((count ?? 0) === 0) {
        blockers.push("migration_record_missing");
      }
    }
  }

  return {
    passed: blockers.length === 0,
    blockers,
  };
}
