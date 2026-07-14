import { createDatabaseClient } from "@/lib/db/database-client";
import { requireAdmin } from "@/lib/auth/require-admin";


export default async function AdminAuditLogsPage() {
  await requireAdmin();

  const db = await createDatabaseClient();
  const { data: logs, error } = await db
    .from("admin_audit_logs")
    .select("id, action, target_type, target_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return <p className="text-red-600">Failed to load audit logs.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <table className="w-full border text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2">Action</th>
            <th className="border px-3 py-2">Target</th>
            <th className="border px-3 py-2">Target ID</th>
            <th className="border px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {logs?.map((log: AuditLog) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td className="border px-3 py-2">{log.action}</td>
              <td className="border px-3 py-2">{log.target_type}</td>
              <td className="border px-3 py-2 font-mono text-xs">
                {log.target_id}
              </td>
              <td className="border px-3 py-2">{log.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
};
