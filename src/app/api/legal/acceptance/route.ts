import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { LegalAcceptanceSchema } from "@/schemas/legal/legal-acceptance-schema";
import {
  getOrCreateLegalAcceptance,
  acceptLegalTerms,
} from "@/features/legal/services/legal-acceptance-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await getOrCreateLegalAcceptance({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/legal/acceptance",
      method: "GET",
    });
  }
}

export async function PATCH(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, LegalAcceptanceSchema);
    const result = await acceptLegalTerms({ userId: user.id, ...input });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/legal/acceptance",
      method: "PATCH",
    });
  }
}
