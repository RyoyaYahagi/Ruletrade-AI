import { createServerClient } from "@/lib/db/supabase-server";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();

  const supabase = await createServerClient();
  const { data: users, error } = await supabase
    .from("app_users")
    .select("id, email, created_at, role")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return <p className="text-red-600">Failed to load users.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <table className="w-full border text-left text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2">ID</th>
            <th className="border px-3 py-2">Email</th>
            <th className="border px-3 py-2">Role</th>
            <th className="border px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="border px-3 py-2 font-mono text-xs">{u.id}</td>
              <td className="border px-3 py-2">{u.email}</td>
              <td className="border px-3 py-2">{u.role ?? "user"}</td>
              <td className="border px-3 py-2">{u.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
