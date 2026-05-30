import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDataDeletionRequest } from "@/features/privacy/services/data-deletion-request-service";
import { deleteUserRagMemory } from "@/features/privacy/services/rag-memory-delete-service";

export async function POST() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const deletionReq = await createDataDeletionRequest({
      userId: user.id,
      deletionType: "rag_memory",
      targetType: "rag_memory",
    });
    const result = await deleteUserRagMemory({ userId: user.id });
    return apiSuccess({
      ...result,
      deletionRequest: deletionReq.deletionRequest,
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/delete/rag-memory",
      method: "POST",
    });
  }
}
