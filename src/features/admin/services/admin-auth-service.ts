import "server-only";

import { requireAdmin } from "@/lib/auth/require-admin";

const GRANULAR_PERMISSIONS: Record<string, string[]> = {
  "admin:read": ["admin:read", "admin:write"],
  "admin:write": ["admin:write"],
  "admin:delete": ["admin:write", "admin:delete"],
};

export async function requireAdminPermission(permission: string) {
  const user = await requireAdmin();

  const allowed = GRANULAR_PERMISSIONS[permission];
  if (!allowed) {
    // Unknown permission: default to requiring full admin access
    return { user };
  }

  // Currently all admin roles share the same elevated privileges.
  // When introducing sub-roles (e.g. support, billing), expand here.
  return { user };
}
