import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listActiveArticlesByTopic, listKnowledgeArticles } from "@/features/knowledge/services/knowledge-article-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireUser();
    const topicKey = new URL(request.url).searchParams.get("topicKey");
    return apiSuccess(
      topicKey
        ? await listActiveArticlesByTopic(topicKey)
        : await listKnowledgeArticles({ activeOnly: true }),
    );
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/knowledge", method: "GET" });
  }
}
