import { listRoadmapItems } from "@/features/release/services/roadmap-service";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const { data: items } = await listRoadmapItems({ is_public: true });
    return apiSuccess({ items });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/roadmap",
      method: "GET",
    });
  }
}
