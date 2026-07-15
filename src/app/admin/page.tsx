import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-600">
        Ruletrade-AI internal operations console. Access is restricted to admin
        users.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/admin/users"
          className="rounded border p-4 hover:bg-gray-50"
        >
          <h2 className="font-semibold">Users</h2>
          <p className="text-sm text-gray-500">Search and review users</p>
        </Link>
        <Link
          href="/admin/events"
          className="rounded border p-4 hover:bg-gray-50"
        >
          <h2 className="font-semibold">System Events</h2>
          <p className="text-sm text-gray-500">View system events and alerts</p>
        </Link>
        <Link
          href="/admin/audit-logs"
          className="rounded border p-4 hover:bg-gray-50"
        >
          <h2 className="font-semibold">Audit Logs</h2>
          <p className="text-sm text-gray-500">Review admin actions</p>
        </Link>
      </div>
    </div>
  );
}
