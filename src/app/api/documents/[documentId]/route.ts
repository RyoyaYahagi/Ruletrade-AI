import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { AppError } from "@/lib/errors/app-error";
import { createServerClient } from "@/lib/db/supabase-server";
import { deleteDocument } from "@/features/documents/services/document-delete-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const { documentId } = await params;

    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("user_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      throw new AppError("NOT_FOUND", "資料が見つかりません。", 404);
    }

    return apiSuccess({ document: data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/documents/[documentId]",
      method: "GET",
    });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const { documentId } = await params;

    const result = await deleteDocument({
      userId: user.id,
      documentId,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/documents/[documentId]",
      method: "DELETE",
    });
  }
}
