import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { z } from "zod";
import {
  getPracticeRuleById,
  updatePracticeRule,
  togglePracticeRuleActive,
  deletePracticeRule,
} from "@/features/education/services/practice-rule-service";

const UpdateRuleRequestSchema = z.object({
  rule_name: z.string().min(1).max(200).optional(),
  rule_type: z
    .enum(["entry", "exit", "position_size", "risk_management", "review"])
    .optional(),
  condition_description: z.string().min(1).max(2000).optional(),
  max_position_ratio: z.number().min(0).max(1).nullable().optional(),
  max_loss_amount: z.number().min(0).nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await getPracticeRuleById(id, user.id);
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = await validateJsonRequest(request, UpdateRuleRequestSchema);

    // If only is_active is provided, use togglePracticeRuleActive
    if (input.is_active !== undefined && Object.keys(input).length === 1) {
      const result = await togglePracticeRuleActive(
        id,
        user.id,
        input.is_active,
      );
      return apiSuccess(result);
    }

    const { is_active: _, ...updateFields } = input;
    const result = await updatePracticeRule({
      ruleId: id,
      userId: user.id,
      ...updateFields,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    await deletePracticeRule(id, user.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
