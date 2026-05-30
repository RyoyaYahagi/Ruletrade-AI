import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function isStopSwitchActive(params: { switchKey: string }) {
  if (process.env.ENABLE_LAUNCH_STOP_SWITCHES !== "true") return false;
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("launch_stop_switches")
    .select("is_active")
    .eq("switch_key", params.switchKey)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.is_active);
}

export async function assertStopSwitchOff(params: { switchKey: string }) {
  const active = await isStopSwitchActive({ switchKey: params.switchKey });
  if (active) {
    throw Object.assign(new Error("This feature is temporarily disabled."), {
      code: "FEATURE_TEMPORARILY_DISABLED",
    });
  }
  return { enabled: true };
}
