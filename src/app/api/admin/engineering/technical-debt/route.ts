export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { CreateTechnicalDebtRequestSchema } from "@/schemas/engineering/engineering-schema";
import {
  createTechnicalDebtItem,
  listTechnicalDebtItems,
} from "@/features/engineering/services/technical-debt-service";

export async function GET(request: Request) {
  try {
    await requireAdminPermission(request);
    const { searchParams } = new URL(request.url);
    const result = await listTechnicalDebtItems({
      status: searchParams.get("status") ?? undefined,
      area: searchParams.get("area") ?? undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminPermission(request);
    const body = await validateJsonRequest(
      request,
      CreateTechnicalDebtRequestSchema,
    );
    const result = await createTechnicalDebtItem(body);
    await logAdminAudit({
      action: "technical_debt_created",
      details: { debtKey: body.debtKey, title: body.title },
    });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
