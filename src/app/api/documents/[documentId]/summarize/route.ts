import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { summarizeDocument } from "@/features/documents/services/document-summary-service";

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

    const result = await summarizeDocument({
      userId: user.id,
      documentId,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/documents/[documentId]/summarize",
      method: "POST",
    });
  }
}
