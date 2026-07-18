import { z } from "zod";
import { UuidSchema } from "@/schemas/common/primitive-schema";

export const RuleFunnelEventNameSchema = z.enum([
  "session_created",
  "session_resumed",
  "session_completed",
  "question_viewed",
  "question_started",
  "answer_saved",
  "question_skipped",
  "thesis_draft_requested",
  "thesis_draft_succeeded",
  "thesis_draft_failed",
  "thesis_draft_cache_hit",
]);

export const RuleEngagementEventNameSchema = z.enum([
  "session_resumed",
  "question_viewed",
  "question_started",
]);

export const RuleFunnelEventMetadataSchema = z
  .record(z.string().max(80), z.unknown())
  .refine((value) => Object.keys(value).length <= 20, {
    message: "イベントメタデータが多すぎます。",
  });

export const TrackRuleEngagementRequestSchema = z.object({
  eventId: UuidSchema,
  eventName: RuleEngagementEventNameSchema,
  questionId: UuidSchema.optional(),
  questionKey: z.string().min(1).max(100).optional(),
  metadata: RuleFunnelEventMetadataSchema.optional(),
}).superRefine((value, context) => {
  if (value.eventName !== "session_resumed" && (!value.questionId || !value.questionKey)) {
    context.addIssue({ code: "custom", message: "質問情報が必要です。", path: ["questionId"] });
  }
});

export const RuleAnalyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type RuleFunnelEventName = z.infer<typeof RuleFunnelEventNameSchema>;
export type RuleEngagementEventName = z.infer<
  typeof RuleEngagementEventNameSchema
>;
export type RuleFunnelEventMetadata = z.infer<
  typeof RuleFunnelEventMetadataSchema
>;
export type TrackRuleEngagementRequest = z.infer<
  typeof TrackRuleEngagementRequestSchema
>;
