import { createAdminClient } from "@/lib/db/supabase-admin";

const FORBIDDEN_PUBLIC_ENV_PATTERNS = [
  /SECRET/i,
  /SERVICE_ROLE/i,
  /PRIVATE/i,
  /TOKEN/i,
  /API_KEY/i,
];

function assertNoPublicSecretKey(key: string) {
  if (!key.startsWith("NEXT_PUBLIC_")) return;
  const unsafe = FORBIDDEN_PUBLIC_ENV_PATTERNS.some((pattern) => pattern.test(key));
  if (unsafe) {
    throw new Error(`Unsafe public env key: ${key}`);
  }
}

async function main() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("environment_variable_inventory")
    .select("*, deployment_environments(environment_key)")
    .eq("is_required", true)
    .eq("is_configured", false);

  if (error) {
    console.error("Failed to load env inventory:", error);
    process.exit(1);
  }

  const missing = data ?? [];
  if (missing.length > 0) {
    console.error("Missing required env variables:");
    for (const item of missing) {
      console.error(`  ${(item.deployment_environments as { environment_key?: string })?.environment_key ?? "?"} / ${item.variable_key}`);
    }
    process.exit(1);
  }

  const { data: allVars } = await supabase
    .from("environment_variable_inventory")
    .select("variable_key, should_be_next_public");

  for (const v of allVars ?? []) {
    assertNoPublicSecretKey(v.variable_key);
  }

  console.log("Env inventory check passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
