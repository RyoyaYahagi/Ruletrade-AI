import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { KnowledgeArticleUpdateSchema } from "@/schemas/knowledge/knowledge-article-schema";
import {
  deactivateKnowledgeArticle,
  updateKnowledgeArticle,
} from "@/features/knowledge/services/knowledge-article-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const { articleId } = await params;
    const input = await validateJsonRequest(request, KnowledgeArticleUpdateSchema);
    return apiSuccess(await updateKnowledgeArticle({ articleId, input }));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/admin/knowledge/[articleId]", method: "PATCH" });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const { articleId } = await params;
    return apiSuccess(await deactivateKnowledgeArticle(articleId));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/admin/knowledge/[articleId]", method: "DELETE" });
  }
}
