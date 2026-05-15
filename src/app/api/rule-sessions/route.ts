import { requireUser } from "@/lib/auth/require-user";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { CreateRuleSessionRequestSchema } from "@/schemas/api/rule-session-api-schema";
import {
  createRuleSession,
  listRuleSessions,
} from "@/features/rules/services/rule-session-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    await ensureAppUser(user);
    const input = await validateJsonRequest(
      request,
      CreateRuleSessionRequestSchema,
    );
    const result = await createRuleSession({ userId: user.id, ...input });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await listRuleSessions({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
