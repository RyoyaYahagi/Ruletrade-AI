import "server-only";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { AppError } from "@/lib/errors/app-error";

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("UNAUTHORIZED", "ログインが必要です。", 401);
  }

  return user;
}
