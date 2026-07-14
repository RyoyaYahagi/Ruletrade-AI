import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { createDatabaseClient } from "@/lib/db/database-client";

interface Review {
  id: string;
  review_key: string;
  phase: string;
  status: string;
  summary: string | null;
}
interface StopSwitch {
  id: string;
  display_name: string;
  switch_key: string;
  severity: string;
  is_active: boolean;
}

export default async function Page() {
  await requireAdminPermission("admin.launch.read");
  const db = await createDatabaseClient();
  const { data: reviews } = await db
    .from("launch_readiness_reviews")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: switches } = await db
    .from("launch_stop_switches")
    .select("*")
    .order("switch_key");

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Launch Readiness</h1>
      <section>
        <h2 className="text-lg font-semibold">Readiness Reviews</h2>
        <ul className="mt-2 space-y-2">
          {((reviews ?? []) as Review[]).map((r) => (
            <li key={r.id} className="rounded border p-3">
              <div className="font-medium">
                {r.review_key}{" "}
                <span className="text-xs text-gray-500">({r.phase})</span>
              </div>
              <div className="text-sm text-gray-600">
                Status: {r.status} | {r.summary ?? "No summary"}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Stop Switches</h2>
        <ul className="mt-2 space-y-2">
          {((switches ?? []) as StopSwitch[]).map((s) => (
            <li key={s.id} className="rounded border p-3">
              <div className="font-medium">
                {s.display_name}{" "}
                <span className="text-xs text-gray-500">({s.switch_key})</span>
              </div>
              <div className="text-sm text-gray-600">
                Severity: {s.severity} | Active: {s.is_active ? "YES" : "no"}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
