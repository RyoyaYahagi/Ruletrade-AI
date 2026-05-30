import { z } from "zod";

export const CreateSupportTicketSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  category: z
    .enum([
      "general",
      "auth",
      "ai_review",
      "rag",
      "document",
      "privacy",
      "billing",
      "security",
      "bug",
      "feedback",
    ])
    .default("general"),
  requestId: z.string().optional(),
  currentPath: z.string().optional(),
});

export const CreateSupportCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const UpdateSupportTicketSchema = z.object({
  status: z
    .enum(["open", "pending", "resolved", "closed", "escalated"])
    .optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
});
