import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import type {
  FeatureFlagProvider,
  FeatureFlagValue,
  FeatureFlagContext,
} from "./types";

export class DbFeatureFlagProvider implements FeatureFlagProvider {
  async getFlag<T extends FeatureFlagValue>(
    flagKey: string,
    defaultValue: T,
    context: FeatureFlagContext,
  ): Promise<T> {
    const db = await createDatabaseClient();

    // 1. Fetch the flag definition
    const { data: flag, error: flagError } = await db
      .from("feature_flags")
      .select("id, flag_type, default_value, is_enabled, is_safety_critical")
      .eq("flag_key", flagKey)
      .eq("is_enabled", true)
      .single();

    if (flagError || !flag) {
      return defaultValue;
    }

    // 2. Safety-critical guards: never disable in production
    if (
      flag.is_safety_critical &&
      context.environment === "production" &&
      defaultValue === true
    ) {
      return true as T;
    }

    // 3. Fetch rules for this flag and environment
    const { data: rules, error: rulesError } = await db
      .from("feature_flag_rules")
      .select("id, rule_type, conditions_json, value_json, priority")
      .eq("feature_flag_id", flag.id)
      .eq("environment", context.environment)
      .eq("is_enabled", true)
      .order("priority", { ascending: true });

    if (rulesError || !rules || rules.length === 0) {
      return (flag.default_value as T) ?? defaultValue;
    }

    // 4. Evaluate rules in priority order
    for (const rule of rules) {
      const matches = evaluateRule(
        rule.rule_type,
        rule.conditions_json,
        context,
      );
      if (matches) {
        // 5. Log evaluation
        await db.from("feature_flag_evaluations").insert({
          user_id: context.userId,
          flag_key: flagKey,
          environment: context.environment,
          evaluated_value: rule.value_json,
          rule_id: rule.id,
          context_json: {
            role: context.role,
            plan: context.plan,
            experienceLevel: context.experienceLevel,
          },
        });

        return rule.value_json as T;
      }
    }

    // 6. No matching rule: return default
    return (flag.default_value as T) ?? defaultValue;
  }
}

function evaluateRule(
  ruleType: string,
  conditions: Record<string, unknown>,
  context: FeatureFlagContext,
): boolean {
  switch (ruleType) {
    case "default":
      return true;
    case "user_id": {
      const allowed = conditions.user_ids as string[] | undefined;
      return allowed ? allowed.includes(context.userId ?? "") : false;
    }
    case "email_domain": {
      const domains = conditions.domains as string[] | undefined;
      if (!domains || !context.email) return false;
      const emailDomain = context.email.split("@")[1];
      return domains.includes(emailDomain);
    }
    case "percentage": {
      const percentage = conditions.percentage as number | undefined;
      if (percentage === undefined || !context.userId) return false;
      const hash = getStableHash(`${context.userId}:flag`);
      return hash % 100 < percentage;
    }
    case "role": {
      const roles = conditions.roles as string[] | undefined;
      return roles ? roles.includes(context.role ?? "user") : false;
    }
    case "plan": {
      const plans = conditions.plans as string[] | undefined;
      return plans ? plans.includes(context.plan ?? "free") : false;
    }
    case "experience_level": {
      const levels = conditions.levels as string[] | undefined;
      return levels
        ? levels.includes(context.experienceLevel ?? "beginner")
        : false;
    }
    default:
      return false;
  }
}

function getStableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
