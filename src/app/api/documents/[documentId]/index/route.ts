import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { indexDocumentForRag } from "@/features/documents/services/document-index-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const { documentId } = await params;

    const result = await indexDocumentForRag({
      userId: user.id,
      documentId,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/documents/[documentId]/index",
      method: "POST",
    });
  }
}
