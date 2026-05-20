import "server-only";

import { requireAdmin } from "@/lib/auth/require-admin";

export async function requireAdminPermission(_permission: string) {
  const user = await requireAdmin();
  return { user };
}
