import { z } from "zod";

export const DeploymentEnvironmentTypeSchema = z.enum([
  "local",
  "preview",
  "staging",
  "production",
]);

export const DeploymentStatusSchema = z.enum([
  "created",
  "building",
  "deployed",
  "failed",
  "promoted",
  "rolled_back",
  "cancelled",
]);

export const DeploymentCheckStatusSchema = z.enum([
  "unchecked",
  "passed",
  "failed",
  "blocked",
  "skipped",
]);

export const CreateDeploymentRecordRequestSchema = z.object({
  deploymentKey: z.string().min(1).max(200),
  environmentKey: z.string().min(1).max(100),
  releaseKey: z.string().max(200).optional(),
  version: z.string().max(100).optional(),
  deploymentUrl: z.string().url().optional(),
  branchName: z.string().max(200).optional(),
  commitSha: z.string().max(100).optional(),
  pullRequestUrl: z.string().url().optional(),
  includesDbMigration: z.boolean().default(false),
  includesEnvChange: z.boolean().default(false),
  includesFeatureFlagChange: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const UpdateDeploymentCheckRequestSchema = z.object({
  status: DeploymentCheckStatusSchema,
  evidenceUrl: z.string().url().optional(),
  notes: z.string().max(5000).optional(),
});

export type DeploymentEnvironmentType = z.infer<typeof DeploymentEnvironmentTypeSchema>;
