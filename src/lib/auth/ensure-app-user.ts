import "server-only";

import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { AppError } from "@/lib/errors/app-error";

export async function ensureAppUser(user: User) {
  if (process.env.MOCK_AUTH === "true" && process.env.DB_PROVIDER === "supabase") {
    return { id: user.id, email: user.email ?? null };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("app_users")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
      },
      {
        onConflict: "id",
      },
    )
    .select("id, email")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ユーザー情報の初期化に失敗しました。",
      500,
      error,
    );
  }

  return data;
}
