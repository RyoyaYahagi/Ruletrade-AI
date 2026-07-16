import { requireAdmin } from "@/lib/auth/require-admin";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import {
  addModelPricing,
  listModelPricing,
} from "@/features/ai/services/model-pricing-service";
import { CreateModelPricingSchema } from "@/schemas/ai/model-pricing-schema";

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    await requireAdmin();
    return apiSuccess(await listModelPricing());
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/model-pricing",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    await requireAdmin();
    const input = await validateJsonRequest(request, CreateModelPricingSchema);
    return apiCreated(await addModelPricing(input));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/model-pricing",
      method: "POST",
    });
  }
}
