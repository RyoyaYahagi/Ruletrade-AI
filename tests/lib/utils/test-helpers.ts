import { createServerClient } from "@/lib/db/supabase-server";

export async function resetTestDatabase() {
  const supabase = await createServerClient();
  // Truncate test tables in dependency order
  await supabase.rpc("truncate_test_tables");
}

export function createMockUser(overrides?: Partial<{ id: string; email: string }>) {
  return {
    id: crypto.randomUUID(),
    email: "test@example.com",
    ...overrides,
  };
}
