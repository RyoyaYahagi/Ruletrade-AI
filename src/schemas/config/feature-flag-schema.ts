import { z } from "zod";

export const FeatureFlagTypeSchema = z.enum([
  "boolean",
  "variant",
  "percentage",
  "user_targeting",
  "environment",
]);

export const FeatureFlagRuleTypeSchema = z.enum([
  "default",
  "user_id",
  "email_domain",
  "percentage",
  "experience_level",
  "plan",
  "role",
]);

export const FeatureFlagEnvironmentSchema = z.enum([
  "local",
  "development",
  "preview",
  "production",
]);

export const FeatureFlagChangeTypeSchema = z.enum([
  "created",
  "updated",
  "enabled",
  "disabled",
  "rule_added",
  "rule_updated",
  "rule_removed",
]);

export const FeatureFlagSchema = z.object({
  id: z.string().uuid(),
  flag_key: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  flag_type: FeatureFlagTypeSchema,
  default_value: z.unknown(),
  is_enabled: z.boolean().default(true),
  is_safety_critical: z.boolean().default(false),
  owner: z.string().max(200).optional(),
  expires_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const FeatureFlagRuleSchema = z.object({
  id: z.string().uuid(),
  feature_flag_id: z.string().uuid(),
  environment: FeatureFlagEnvironmentSchema,
  rule_type: FeatureFlagRuleTypeSchema,
  conditions_json: z.record(z.string(), z.unknown()).default({}),
  value_json: z.unknown(),
  priority: z.number().int().min(0).max(1000).default(100),
  is_enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const FeatureFlagEvaluationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  flag_key: z.string().min(1),
  environment: FeatureFlagEnvironmentSchema,
  evaluated_value: z.unknown(),
  rule_id: z.string().uuid().optional().nullable(),
  context_json: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
});

export const FeatureFlagChangeLogSchema = z.object({
  id: z.string().uuid(),
  changed_by: z.string().uuid().optional().nullable(),
  flag_key: z.string().min(1),
  change_type: FeatureFlagChangeTypeSchema,
  before_json: z.record(z.string(), z.unknown()).optional().nullable(),
  after_json: z.record(z.string(), z.unknown()).optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
  created_at: z.string().datetime(),
});

export type FeatureFlagType = z.infer<typeof FeatureFlagTypeSchema>;
export type FeatureFlagRuleType = z.infer<typeof FeatureFlagRuleTypeSchema>;
export type FeatureFlagEnvironment = z.infer<
  typeof FeatureFlagEnvironmentSchema
>;
export type FeatureFlagChangeType = z.infer<typeof FeatureFlagChangeTypeSchema>;
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
export type FeatureFlagRule = z.infer<typeof FeatureFlagRuleSchema>;
export type FeatureFlagEvaluation = z.infer<typeof FeatureFlagEvaluationSchema>;
export type FeatureFlagChangeLog = z.infer<typeof FeatureFlagChangeLogSchema>;
