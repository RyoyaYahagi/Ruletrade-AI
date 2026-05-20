import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDataDeletionRequest } from "@/features/privacy/services/data-deletion-request-service";
import { deleteUserDocument } from "@/features/privacy/services/document-delete-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { documentId } = await params;
    const deletionReq = await createDataDeletionRequest({
      userId: user.id,
      deletionType: "document",
      targetType: "document",
      targetId: documentId,
    });
    const result = await deleteUserDocument({ userId: user.id, documentId });
    return apiSuccess({
      ...result,
      deletionRequest: deletionReq.deletionRequest,
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/delete/document/[documentId]",
      method: "POST",
    });
  }
}
