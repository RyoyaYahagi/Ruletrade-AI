import { z } from "zod";

export const ReleasePhaseSchema = z.enum([
  "internal_alpha",
  "private_beta",
  "expanded_beta",
  "release_candidate",
  "public_launch",
  "hotfix",
]);

export const ReleaseStatusSchema = z.enum([
  "draft",
  "planned",
  "code_freeze",
  "qa",
  "approved",
  "released",
  "rolled_back",
  "cancelled",
]);

export const ReleaseTypeSchema = z.enum([
  "major",
  "minor",
  "patch",
  "hotfix",
  "prerelease",
]);

export const ReleaseRiskLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const ChangelogCategorySchema = z.enum([
  "added",
  "changed",
  "deprecated",
  "removed",
  "fixed",
  "security",
]);

export const RoadmapPublicStatusSchema = z.enum([
  "exploring",
  "planned",
  "in_progress",
  "beta",
  "released",
  "paused",
  "cancelled",
]);

export const RoadmapInternalStatusSchema = z.enum([
  "idea",
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "done",
  "released",
  "deferred",
  "cancelled",
]);

export const MilestonePhaseSchema = z.enum([
  "internal_alpha",
  "private_beta",
  "expanded_beta",
  "release_candidate",
  "public_launch",
  "open_beta",
  "post_launch",
]);

export const MilestoneStatusSchema = z.enum([
  "planned",
  "active",
  "frozen",
  "completed",
  "cancelled",
]);

export const PrioritySchema = z.enum(["p0", "p1", "p2", "p3", "p4"]);

export const CreateReleasePlanRequestSchema = z.object({
  releaseKey: z.string().min(1).max(200),
  version: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  summary: z.string().max(5000).optional(),
  phase: ReleasePhaseSchema,
  releaseType: ReleaseTypeSchema.default("minor"),
  milestoneKey: z.string().max(200).optional(),
  plannedReleaseAt: z.string().datetime().optional(),
  includesDbMigration: z.boolean().default(false),
  includesDataAccessChange: z.boolean().default(false),
  includesEnvChange: z.boolean().default(false),
  includesFeatureFlagChange: z.boolean().default(false),
  includesAiPromptChange: z.boolean().default(false),
  includesBillingChange: z.boolean().default(false),
  includesPrivacyChange: z.boolean().default(false),
  rollbackStrategy: z.string().max(5000).optional(),
});

export const UpdateReleasePlanStatusRequestSchema = z.object({
  status: ReleaseStatusSchema,
  notes: z.string().max(5000).optional(),
});

export const CreateChangelogEntryRequestSchema = z.object({
  releasePlanId: z.string().uuid(),
  category: ChangelogCategorySchema,
  audience: z.enum(["internal", "public", "both"]).default("internal"),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(5000),
  isBreakingChange: z.boolean().default(false),
  isPublicSafe: z.boolean().default(false),
});

export const CreateRoadmapItemRequestSchema = z.object({
  itemKey: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(5000),
  theme: z.string().min(1).max(100),
  initiative: z.string().max(200).optional(),
  publicStatus: RoadmapPublicStatusSchema.default("planned"),
  internalStatus: RoadmapInternalStatusSchema.default("backlog"),
  priority: PrioritySchema.default("p2"),
  targetMilestoneKey: z.string().max(200).optional(),
  targetReleaseKey: z.string().max(200).optional(),
  isPublic: z.boolean().default(false),
  sortOrder: z.number().int().default(1000),
});

export const CreateMilestoneRequestSchema = z.object({
  milestoneKey: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  phase: MilestonePhaseSchema,
  targetDate: z.string().date().optional(),
  githubMilestoneUrl: z.string().url().max(2000).optional(),
  githubProjectUrl: z.string().url().max(2000).optional(),
});

export const CreateReleaseChecklistRequestSchema = z.object({
  releasePlanId: z.string().uuid(),
  checklistKey: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
});

export const UpdateChecklistItemStatusRequestSchema = z.object({
  status: z.enum([
    "unchecked",
    "passed",
    "failed",
    "blocked",
    "not_applicable",
  ]),
  notes: z.string().max(5000).optional(),
});

export const CreateReleaseApprovalRequestSchema = z.object({
  releasePlanId: z.string().uuid(),
  approvalType: z.enum([
    "owner",
    "technical",
    "security",
    "privacy",
    "billing",
    "release_manager",
  ]),
  comment: z.string().max(5000).optional(),
});

export const CreateRiskAssessmentRequestSchema = z.object({
  releasePlanId: z.string().uuid(),
  riskArea: z.enum([
    "db",
    "ownership",
    "ai_safety",
    "privacy",
    "security",
    "billing",
    "performance",
    "observability",
    "support",
    "rollback",
    "other",
  ]),
  riskLevel: ReleaseRiskLevelSchema,
  description: z.string().min(1).max(5000),
  mitigation: z.string().max(5000).optional(),
});

export type ReleasePhase = z.infer<typeof ReleasePhaseSchema>;
export type ReleaseStatus = z.infer<typeof ReleaseStatusSchema>;
export type ReleaseType = z.infer<typeof ReleaseTypeSchema>;
export type ReleaseRiskLevel = z.infer<typeof ReleaseRiskLevelSchema>;
export type ChangelogCategory = z.infer<typeof ChangelogCategorySchema>;
export type RoadmapPublicStatus = z.infer<typeof RoadmapPublicStatusSchema>;
export type RoadmapInternalStatus = z.infer<typeof RoadmapInternalStatusSchema>;
export type MilestonePhase = z.infer<typeof MilestonePhaseSchema>;
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
