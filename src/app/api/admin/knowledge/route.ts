import { requireAdmin } from "@/lib/auth/require-admin";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { KnowledgeArticleSchema } from "@/schemas/knowledge/knowledge-article-schema";
import {
  createKnowledgeArticle,
  listKnowledgeArticles,
} from "@/features/knowledge/services/knowledge-article-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    return apiSuccess(await listKnowledgeArticles());
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/admin/knowledge", method: "GET" });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const input = await validateJsonRequest(request, KnowledgeArticleSchema);
    return apiCreated(await createKnowledgeArticle(input));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/admin/knowledge", method: "POST" });
  }
}
