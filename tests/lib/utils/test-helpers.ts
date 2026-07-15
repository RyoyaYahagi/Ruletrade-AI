import { createDatabaseClient } from "@/lib/db/database-client";

export async function resetTestDatabase() {
  const db = await createDatabaseClient();
  const tables = [
    "rule_answers",
    "rule_questions",
    "rule_design_sessions",
    "app_users",
  ];
  for (const table of tables) {
    await db.from(table).delete();
  }
}

export function createMockUser(overrides?: Partial<{ id: string; email: string }>) {
  return {
    id: crypto.randomUUID(),
    email: "test@example.com",
    ...overrides,
  };
}
