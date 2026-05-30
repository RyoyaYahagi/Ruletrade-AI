import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { reindexUserRagDocuments } from "@/features/rag/services/reindex-user-rag-documents";

export async function POST() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const result = await reindexUserRagDocuments({
      userId: user.id,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/rag/reindex",
      method: "POST",
    });
  }
}
