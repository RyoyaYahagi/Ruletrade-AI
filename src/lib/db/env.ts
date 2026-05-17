const missingPublicSupabaseEnvMessage =
  "Missing public Supabase environment variables";

export function getOptionalPublicSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function getPublicSupabaseEnv() {
  const env = getOptionalPublicSupabaseEnv();

  if (!env) {
    throw new Error(missingPublicSupabaseEnvMessage);
  }

  return env;
}
