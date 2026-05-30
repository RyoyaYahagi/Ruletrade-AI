import { z } from "zod";

export const RedeemInviteCodeRequestSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required."),
});

export const CreateBetaInviteCodeRequestSchema = z.object({
  cohortId: z.string().uuid("Cohort ID is required."),
  maxUses: z.number().int().min(1).default(1),
  expiresAt: z.string().datetime().optional(),
});

export const UpdateBetaAccessGrantSchema = z.object({
  accessStatus: z.enum(["active", "paused", "revoked", "graduated"]),
});

export const UpdateBetaFeatureFlagSchema = z.object({
  isEnabledGlobally: z.boolean().optional(),
  enabledCohortKeys: z.array(z.string()).optional(),
  killSwitchEnabled: z.boolean().optional(),
});

export const UpdateLaunchChecklistItemSchema = z.object({
  status: z.enum([
    "unchecked",
    "passed",
    "failed",
    "not_applicable",
    "blocked",
  ]),
  notes: z.string().optional(),
});

export const UpdateStopSwitchSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});
