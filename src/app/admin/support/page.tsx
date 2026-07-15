import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { createDatabaseClient } from "@/lib/db/database-client";

export default async function Page() {
  await requireAdminPermission("admin.support.read");
  const db = await createDatabaseClient();
  const { data: tickets } = await db
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Support Inbox</h1>
      <ul className="space-y-3">
        {(tickets ?? []).map(
          (t: {
            id: string;
            subject: string;
            status: string;
            email: string;
            category: string;
            priority: string;
            body: string;
          }) => (
            <li key={t.id} className="rounded border p-3 text-sm">
              <div className="font-medium">
                {t.subject}{" "}
                <span className="text-xs text-gray-500">({t.status})</span>
              </div>
              <div className="text-gray-600">
                {t.email} — {t.category} — {t.priority}
              </div>
              <div className="mt-1 text-gray-700">{t.body}</div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
