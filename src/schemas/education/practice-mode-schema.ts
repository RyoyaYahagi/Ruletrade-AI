import { z } from "zod";

export const PracticeSessionStatusSchema = z.enum([
  "active",
  "paused",
  "completed",
  "abandoned",
]);

export const VirtualTradeStatusSchema = z.enum(["open", "closed", "cancelled"]);

export const VirtualTradeTypeSchema = z.enum(["buy", "sell"]);

export const PracticeRuleTypeSchema = z.enum([
  "entry",
  "exit",
  "position_size",
  "risk_management",
  "review",
]);

export const LessonCategorySchema = z.enum([
  "basics",
  "rules",
  "risk",
  "review",
  "portfolio",
]);

export const LessonStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
]);

export const PracticeSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1).max(200).default("Practice Session"),
  description: z.string().max(2000).optional(),
  virtual_balance: z.number().min(0).default(1000000),
  starting_balance: z.number().min(0).default(1000000),
  currency: z.string().max(10).default("JPY"),
  status: PracticeSessionStatusSchema.default("active"),
  lesson_plan: z.string().max(2000).optional().nullable(),
  target_duration_days: z.number().int().min(1).max(365).optional().nullable(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional().nullable(),
  paused_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const VirtualTradeSchema = z.object({
  id: z.string().uuid(),
  practice_session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  symbol: z.string().min(1).max(50),
  symbol_name: z.string().max(200).optional().nullable(),
  trade_type: VirtualTradeTypeSchema,
  quantity: z.number().positive(),
  entry_price: z.number().positive(),
  exit_price: z.number().positive().optional().nullable(),
  virtual_amount: z.number().min(0),
  realized_pnl: z.number().optional().nullable(),
  trade_reason: z.string().max(2000).optional().nullable(),
  exit_reason: z.string().max(2000).optional().nullable(),
  rule_compliance_score: z.number().int().min(0).max(100).optional().nullable(),
  compliance_notes: z.string().max(2000).optional().nullable(),
  status: VirtualTradeStatusSchema.default("open"),
  opened_at: z.string().datetime(),
  closed_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const PracticeRuleSchema = z.object({
  id: z.string().uuid(),
  practice_session_id: z.string().uuid(),
  user_id: z.string().uuid(),
  rule_name: z.string().min(1).max(200),
  rule_type: PracticeRuleTypeSchema,
  condition_description: z.string().min(1).max(2000),
  max_position_ratio: z.number().min(0).max(1).optional().nullable(),
  max_loss_amount: z.number().min(0).optional().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const LessonProgressSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  lesson_id: z.string().min(1).max(200),
  lesson_title: z.string().min(1).max(500),
  lesson_category: LessonCategorySchema,
  status: LessonStatusSchema.default("not_started"),
  completion_percent: z.number().int().min(0).max(100).default(0),
  started_at: z.string().datetime().optional().nullable(),
  completed_at: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PracticeSessionStatus = z.infer<typeof PracticeSessionStatusSchema>;
export type VirtualTradeStatus = z.infer<typeof VirtualTradeStatusSchema>;
export type VirtualTradeType = z.infer<typeof VirtualTradeTypeSchema>;
export type PracticeRuleType = z.infer<typeof PracticeRuleTypeSchema>;
export type LessonCategory = z.infer<typeof LessonCategorySchema>;
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export type PracticeSession = z.infer<typeof PracticeSessionSchema>;
export type VirtualTrade = z.infer<typeof VirtualTradeSchema>;
export type PracticeRule = z.infer<typeof PracticeRuleSchema>;
export type LessonProgress = z.infer<typeof LessonProgressSchema>;
