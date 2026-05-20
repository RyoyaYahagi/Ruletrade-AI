export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { createServerClient } from "@/lib/db/supabase-server";

interface Cohort {
  id: string;
  display_name: string;
  cohort_key: string;
  phase: string;
  max_users: number | null;
  is_active: boolean;
}
interface FeatureFlag {
  id: string;
  display_name: string;
  flag_key: string;
  is_enabled_globally: boolean;
  kill_switch_enabled: boolean;
}
interface Grant {
  id: string;
  user_id: string;
  access_status: string;
  app_users?: { email?: string } | null;
  beta_cohorts?: { cohort_key?: string } | null;
}

export default async function Page() {
  await requireAdminPermission("admin.beta.read");
  const supabase = await createServerClient();
  const { data: cohorts } = await supabase
    .from("beta_cohorts")
    .select("*")
    .order("created_at");
  const { data: flags } = await supabase
    .from("beta_feature_flags")
    .select("*")
    .order("flag_key");
  const { data: grants } = await supabase
    .from("beta_access_grants")
    .select("*, app_users(email), beta_cohorts(cohort_key)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Beta Management</h1>
      <section>
        <h2 className="text-lg font-semibold">Cohorts</h2>
        <ul className="mt-2 space-y-2">
          {((cohorts ?? []) as Cohort[]).map((c) => (
            <li key={c.id} className="rounded border p-3">
              <div className="font-medium">
                {c.display_name}{" "}
                <span className="text-xs text-gray-500">({c.cohort_key})</span>
              </div>
              <div className="text-sm text-gray-600">
                Phase: {c.phase} | Max: {c.max_users ?? "unlimited"} | Active:{" "}
                {c.is_active ? "yes" : "no"}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Feature Flags</h2>
        <ul className="mt-2 space-y-2">
          {((flags ?? []) as FeatureFlag[]).map((f) => (
            <li key={f.id} className="rounded border p-3">
              <div className="font-medium">
                {f.display_name}{" "}
                <span className="text-xs text-gray-500">({f.flag_key})</span>
              </div>
              <div className="text-sm text-gray-600">
                Global: {f.is_enabled_globally ? "ON" : "OFF"} | Kill:{" "}
                {f.kill_switch_enabled ? "ON" : "OFF"}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Recent Access Grants</h2>
        <ul className="mt-2 space-y-2">
          {((grants ?? []) as Grant[]).map((g) => (
            <li key={g.id} className="rounded border p-3 text-sm">
              <span className="font-medium">
                {g.app_users?.email ?? g.user_id}
              </span>{" "}
              — {g.access_status} — {g.beta_cohorts?.cohort_key ?? "no cohort"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
