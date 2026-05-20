import { createServerClient } from "@/lib/db/supabase-server";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminEventsPage() {
  await requireAdmin();

  const supabase = await createServerClient();
  const { data: events, error } = await supabase
    .from("system_events")
    .select("id, event_type, severity, message, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return <p className="text-red-600">Failed to load events.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">System Events</h1>
      <table className="w-full border text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2">Type</th>
            <th className="border px-3 py-2">Severity</th>
            <th className="border px-3 py-2">Message</th>
            <th className="border px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {events?.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50">
              <td className="border px-3 py-2">{e.event_type}</td>
              <td className="border px-3 py-2">{e.severity}</td>
              <td className="border px-3 py-2">{e.message}</td>
              <td className="border px-3 py-2">{e.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
