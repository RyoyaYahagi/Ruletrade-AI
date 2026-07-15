import "server-only";

import type { AppUser } from "@/lib/auth/types";
import { createDatabaseClient } from "@/lib/db/database-client";

export async function ensureAppUser(user: AppUser) {
  if (process.env.MOCK_AUTH === "true") {
    return { id: user.id, email: user.email ?? null };
  }

  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("app_users")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        role: user.app_metadata?.role ?? "user",
      },
      {
        onConflict: "id",
      },
    )
    .select("id, email")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
