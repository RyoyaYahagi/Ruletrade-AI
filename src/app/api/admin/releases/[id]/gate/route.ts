import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { evaluateReleaseGates } from "@/features/release/services/release-gate-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.releases.read");
    const { id } = await params;
    const { passed, blockers } = await evaluateReleaseGates(id);
    return apiSuccess({ passed, blockers });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/releases/[id]/gate",
      method: "POST",
    });
  }
}
