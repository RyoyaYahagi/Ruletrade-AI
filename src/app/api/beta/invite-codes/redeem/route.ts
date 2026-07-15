import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { RedeemInviteCodeRequestSchema } from "@/schemas/launch/beta-schema";
import { redeemInviteCode } from "@/features/launch/services/beta-invite-code-service";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;
  try {
    const user = await requireUser();
    userId = user.id;
    const input = await validateJsonRequest(
      request,
      RedeemInviteCodeRequestSchema,
    );
    const result = await redeemInviteCode({
      userId: user.id,
      inviteCode: input.inviteCode,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/beta/invite-codes/redeem",
      method: "POST",
    });
  }
}
