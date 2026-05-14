import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/supabase-server";

export async function ensureAppUser(user: User) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_users")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
      },
      {
        onConflict: "id",
      }
    )
    .select("id, email")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
