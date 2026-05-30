export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth/require-admin";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-gray-50 p-4">
        <h2 className="mb-4 text-lg font-bold">Admin</h2>
        <nav className="space-y-2">
          <Link
            href="/admin"
            className="block rounded px-2 py-1 hover:bg-gray-200"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/users"
            className="block rounded px-2 py-1 hover:bg-gray-200"
          >
            Users
          </Link>
          <Link
            href="/admin/events"
            className="block rounded px-2 py-1 hover:bg-gray-200"
          >
            System Events
          </Link>
          <Link
            href="/admin/audit-logs"
            className="block rounded px-2 py-1 hover:bg-gray-200"
          >
            Audit Logs
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
