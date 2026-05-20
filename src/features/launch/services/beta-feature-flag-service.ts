import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function isBetaFeatureEnabled(params: {
  userId: string;
  flagKey: string;
}) {
  const supabase = await createServerClient();
  const { data: flag, error: flagError } = await supabase
    .from("beta_feature_flags")
    .select("*")
    .eq("flag_key", params.flagKey)
    .maybeSingle();
  if (flagError) throw flagError;
  if (!flag) return false;
  if (flag.kill_switch_enabled) return false;
  if (flag.is_enabled_globally) return true;
  if ((flag.enabled_user_ids ?? []).includes(params.userId)) return true;

  const { data: grant, error: grantError } = await supabase
    .from("beta_access_grants")
    .select(`access_status, beta_cohorts(cohort_key)`)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (grantError) throw grantError;
  if (!grant || grant.access_status !== "active") return false;
  const cohortKey = (
    grant as unknown as { beta_cohorts?: { cohort_key?: string } }
  ).beta_cohorts?.cohort_key;
  if (!cohortKey) return false;
  return (flag.enabled_cohort_keys ?? []).includes(cohortKey);
}

export async function assertBetaFeatureEnabled(params: {
  userId: string;
  flagKey: string;
}) {
  const enabled = await isBetaFeatureEnabled(params);
  if (!enabled) {
    throw Object.assign(
      new Error("Feature is not enabled for this beta user."),
      {
        code: "FEATURE_NOT_ENABLED",
      },
    );
  }
  return { enabled: true };
}
