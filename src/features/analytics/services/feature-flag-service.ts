import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function isFeatureEnabled(params: {
  userId: string;
  flagName: string;
  userPlan?: string;
  userRole?: string;
}): Promise<boolean> {
  const supabase = await createServerClient();

  const { data: flag } = await supabase
    .from("feature_flags")
    .select("*")
    .eq("name", params.flagName)
    .single();

  if (!flag) return false;
  if (!flag.enabled) return false;

  // Plan check
  if (flag.target_plans?.length > 0 && params.userPlan) {
    if (!flag.target_plans.includes(params.userPlan)) return false;
  }

  // Role check
  if (flag.target_roles?.length > 0 && params.userRole) {
    if (!flag.target_roles.includes(params.userRole)) return false;
  }

  // Rollout percentage
  if (flag.rollout_percentage < 100) {
    const hash = hashUserId(params.userId + flag.name);
    if (hash % 100 >= flag.rollout_percentage) return false;
  }

  return true;
}

function hashUserId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 10000;
}
