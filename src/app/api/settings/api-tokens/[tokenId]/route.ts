import { revokeApiToken } from "@/features/auth/services/api-token-service";
import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { tokenId } = await params;
    return apiSuccess(await revokeApiToken({ userId: user.id, tokenId }));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/settings/api-tokens/[tokenId]",
      method: "DELETE",
    });
  }
}
