import "server-only";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/db/supabase-server";
import { requireUser } from "@/lib/auth/require-user";

export async function getBetaAccessForUser(params: { userId: string }) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("beta_access_grants")
    .select(`*, beta_cohorts (id, cohort_key, display_name, phase, is_active)`)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) throw error;
  return { accessGrant: data };
}

export async function requireBetaAccess() {
  if (process.env.ENABLE_CLOSED_BETA !== "true") {
    return { betaRequired: false, user: null, accessGrant: null };
  }
  const user = await requireUser();
  const { accessGrant } = await getBetaAccessForUser({ userId: user.id });
  if (!accessGrant || accessGrant.access_status !== "active") {
    redirect("/beta/access-required");
  }
  await updateBetaLastSeen({ userId: user.id });
  return { betaRequired: true, user, accessGrant };
}

export async function updateBetaLastSeen(params: { userId: string }) {
  const supabase = await createServerClient();
  await supabase
    .from("beta_access_grants")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", params.userId);
  return { updated: true };
}
