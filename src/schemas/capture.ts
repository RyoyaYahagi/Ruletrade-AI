import { z } from "zod";

import { OriginSchema } from "@/schemas/origin";

export const CaptureStatusSchema = z.enum([
  "pending",
  "organized",
  "discarded",
]);

export const CaptureSchema = z
  .object({
    id: z.string().min(1),
    stockId: z.string().min(1).nullable(),
    stockHint: z.string().nullable(),
    rawInput: z.string().min(1),
    origin: OriginSchema,
    status: CaptureStatusSchema,
    decisionId: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
    organizedAt: z.string().datetime().nullable(),
  })
  .superRefine((capture, context) => {
    const organized = capture.status === "organized";
    const hasDecision = capture.decisionId != null;
    const hasOrganizedAt = capture.organizedAt != null;
    if (
      organized
        ? !hasDecision || !hasOrganizedAt
        : hasDecision || hasOrganizedAt
    )
      context.addIssue({
        code: "custom",
        message: "整理済みの受け箱だけが判断と整理日時を持ちます。",
        path: ["status"],
      });
  });

export type CaptureStatus = z.infer<typeof CaptureStatusSchema>;
export type Capture = z.infer<typeof CaptureSchema>;

export const CaptureInputSchema = z.object({
  rawInput: z.string().refine((value) => value.trim().length > 0, {
    message: "rawInput は空白以外の文字を含めてください。",
  }),
  stockId: z.string().min(1).nullable().optional().default(null),
  stockHint: z.string().nullable().optional().default(null),
});

export type CaptureInput = z.infer<typeof CaptureInputSchema>;
