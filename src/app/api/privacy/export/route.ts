import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { DataExportRequestSchema } from "@/schemas/privacy/data-export-schema";
import {
  requestDataExport,
  generateUserDataExport,
} from "@/features/privacy/services/data-export-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const body = await request.json();
    const input = DataExportRequestSchema.parse(body);
    const exportReq = await requestDataExport({ userId: user.id, ...input });
    const result = await generateUserDataExport({
      userId: user.id,
      exportRequestId: exportReq.exportRequest.id,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/export",
      method: "POST",
    });
  }
}
