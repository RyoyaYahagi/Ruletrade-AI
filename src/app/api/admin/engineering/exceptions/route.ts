export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { CreateEngineeringExceptionRequestSchema } from "@/schemas/engineering/engineering-schema";
import {
  createEngineeringException,
  listEngineeringExceptions,
} from "@/features/engineering/services/engineering-exception-service";

export async function GET(request: Request) {
  try {
    await requireAdminPermission(request);
    const { searchParams } = new URL(request.url);
    const result = await listEngineeringExceptions({
      status: searchParams.get("status") ?? undefined,
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
      CreateEngineeringExceptionRequestSchema,
    );
    const result = await createEngineeringException(body);
    await logAdminAudit({
      action: "engineering_exception_created",
      details: { exceptionKey: body.exceptionKey, title: body.title },
    });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
