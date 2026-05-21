import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  createPracticeRule,
  listPracticeRules,
} from "@/features/education/services/practice-rule-service";

const CreateRuleRequestSchema = z.object({
  practice_session_id: z.string().uuid(),
  rule_name: z.string().min(1).max(200),
  rule_type: z.enum([
    "entry",
    "exit",
    "position_size",
    "risk_management",
    "review",
  ]),
  condition_description: z.string().min(1).max(2000),
  max_position_ratio: z.number().min(0).max(1).nullable().optional(),
  max_loss_amount: z.number().min(0).nullable().optional(),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, CreateRuleRequestSchema);
    const result = await createPracticeRule({ user_id: user.id, ...input });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const practiceSessionId = url.searchParams.get("practice_session_id");
    if (!practiceSessionId) {
      throw new Error("practice_session_id query parameter is required.");
    }
    const ruleType = url.searchParams.get("rule_type") ?? undefined;
    const isActive = url.searchParams.get("is_active");
    const limit = url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined;

    const result = await listPracticeRules({
      practiceSessionId,
      userId: user.id,
      rule_type: ruleType as any,
      is_active: isActive !== null ? isActive === "true" : undefined,
      limit,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
