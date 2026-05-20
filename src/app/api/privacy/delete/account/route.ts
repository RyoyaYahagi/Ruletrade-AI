import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { DataDeletionRequestSchema } from "@/schemas/privacy/data-deletion-schema";
import {
  requestAccountDeletion,
  executeAccountDeletion,
} from "@/features/privacy/services/account-delete-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = DataDeletionRequestSchema.parse(body);
    if (input.deletionType !== "account") {
      throw new Error("Invalid deletion type.");
    }
    const deletionReq = await requestAccountDeletion({
      userId: user.id,
      confirmText: input.confirmText ?? "",
      reason: input.reason,
    });
    const result = await executeAccountDeletion({
      userId: user.id,
      deletionRequestId: deletionReq.deletionRequest.id,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/delete/account",
      method: "POST",
    });
  }
}
