export type DatabaseProvider = "sqlite" | "supabase";

export function getDatabaseProvider(): DatabaseProvider {
  const provider = process.env.DB_PROVIDER ?? "sqlite";

  if (provider === "sqlite" || provider === "supabase") {
    return provider;
  }

  throw new Error(`Unsupported DB_PROVIDER: ${provider}`);
}
