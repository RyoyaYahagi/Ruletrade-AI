import "server-only";

import { requireUser } from "@/lib/auth/require-user";
import { AppError } from "@/lib/errors/app-error";

export async function requireAdmin() {
  const user = await requireUser();
  const role = user.app_metadata.role;

  if (!role || role !== "admin") {
    throw new AppError("FORBIDDEN", "管理者権限が必要です。", 403);
  }

  return user;
}
