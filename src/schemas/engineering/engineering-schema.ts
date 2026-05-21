import { z } from "zod";

export const EngineeringDecisionStatusSchema = z.enum([
  "proposed",
  "accepted",
  "rejected",
  "deprecated",
  "superseded",
]);

export const EngineeringDecisionAreaSchema = z.enum([
  "architecture",
  "db",
  "rls",
  "auth",
  "ai",
  "rag",
  "documents",
  "privacy",
  "security",
  "billing",
  "admin",
  "pwa",
  "observability",
  "release",
  "support",
  "email",
  "infra",
  "other",
]);

export const TechnicalDebtTypeSchema = z.enum([
  "code",
  "test",
  "docs",
  "architecture",
  "security",
  "privacy",
  "performance",
  "observability",
  "ux",
  "infra",
  "dependency",
  "data_model",
]);

export const TechnicalDebtStatusSchema = z.enum([
  "open",
  "accepted",
  "in_progress",
  "paid_down",
  "wont_fix",
  "superseded",
]);

export const EngineeringRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const CreateTechnicalDebtRequestSchema = z.object({
  debtKey: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  debtType: TechnicalDebtTypeSchema,
  priority: z.enum(["p0", "p1", "p2", "p3", "p4"]).default("p2"),
  severity: EngineeringRiskLevelSchema.default("medium"),
  area: z.string().min(1).max(100),
  targetMilestoneKey: z.string().max(200).optional(),
  targetReleaseKey: z.string().max(200).optional(),
  dueDate: z.string().date().optional(),
  acceptedUntil: z.string().date().optional(),
  repaymentPlan: z.string().max(5000).optional(),
  riskIfNotFixed: z.string().max(5000).optional(),
  relatedIssueKey: z.string().max(200).optional(),
  relatedAdrNumber: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CreateEngineeringExceptionRequestSchema = z.object({
  exceptionKey: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  exceptionType: z.enum([
    "rls_exception",
    "service_role_usage",
    "logging_exception",
    "cache_exception",
    "dependency_exception",
    "test_coverage_exception",
    "security_exception",
    "privacy_exception",
    "performance_exception",
    "release_exception",
    "other",
  ]),
  riskLevel: EngineeringRiskLevelSchema.default("medium"),
  expiresAt: z.string().datetime().optional(),
  mitigation: z.string().max(5000).optional(),
  followUpDebtKey: z.string().max(200).optional(),
  relatedIssueKey: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const CreateArchitectureReviewRequestSchema = z.object({
  requestKey: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(5000),
  reviewArea: z.enum([
    "architecture",
    "db",
    "rls",
    "auth",
    "ai",
    "rag",
    "privacy",
    "security",
    "billing",
    "admin",
    "infra",
    "release",
    "other",
  ]),
  riskLevel: EngineeringRiskLevelSchema,
  requiresAdr: z.boolean().default(false),
});

export const CreateDependencyReviewRequestSchema = z.object({
  dependencyName: z.string().min(1).max(200),
  packageManager: z.enum([
    "npm",
    "pnpm",
    "bun",
    "pip",
    "cargo",
    "go",
    "other",
  ]),
  requestedVersion: z.string().max(100).optional(),
  resolvedVersion: z.string().max(100).optional(),
  usageReason: z.string().min(1).max(5000),
  alternativesConsidered: z.string().max(5000).optional(),
  licenseName: z.string().max(100).optional(),
  sourceUrl: z.string().url().max(2000).optional(),
  securityScore: z.string().max(50).optional(),
  knownVulnerabilityCount: z.number().int().min(0).default(0),
  isRuntimeDependency: z.boolean().default(true),
  isClientBundleDependency: z.boolean().default(false),
});

export type EngineeringDecisionStatus = z.infer<
  typeof EngineeringDecisionStatusSchema
>;
export type EngineeringDecisionArea = z.infer<
  typeof EngineeringDecisionAreaSchema
>;
export type TechnicalDebtType = z.infer<typeof TechnicalDebtTypeSchema>;
export type TechnicalDebtStatus = z.infer<typeof TechnicalDebtStatusSchema>;
export type EngineeringRiskLevel = z.infer<typeof EngineeringRiskLevelSchema>;
