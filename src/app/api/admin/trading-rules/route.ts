export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { CreateTradingRuleRequestSchema } from "@/schemas/trading/trading-rule-schema";
import {
  createTradingRule,
  listTradingRules,
} from "@/features/trading/services/trading-rule-service";

export async function GET(request: Request) {
  try {
    const admin = await requireAdminPermission("admin.trading.read");
    const { searchParams } = new URL(request.url);
    const result = await listTradingRules({
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
    });
    return apiSuccess(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission("admin.trading.update");
    const body = await validateJsonRequest(
      request,
      CreateTradingRuleRequestSchema
    );
    const result = await createTradingRule({
      user_id: admin.user.id,
      name: body.name,
      description: body.description,
      entry_conditions: body.entryConditions,
      exit_conditions: body.exitConditions,
      risk_limits: body.riskLimits,
      assumptions: body.assumptions,
      evidence: body.evidence,
      warnings: body.warnings,
      approval_requirements: body.approvalRequirements,
      natural_language_summary: body.naturalLanguageSummary,
      created_by: admin.user.id,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "trading_rule_created",
      targetType: "trading_rule",
      targetId: result.data?.id,
      metadata: { name: body.name },
    });
    return apiCreated(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}
