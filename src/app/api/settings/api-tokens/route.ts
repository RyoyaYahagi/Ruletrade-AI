import { z } from "zod";

import {
  createApiToken,
  listApiTokens,
} from "@/features/auth/services/api-token-service";
import { requireUser } from "@/lib/auth/require-user";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { toErrorResponse } from "@/lib/errors/to-error-response";

const CreateApiTokenSchema = z.object({
  label: z.string().trim().min(1).max(80),
  scopes: z.enum(["read", "read,write"]).default("read"),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    return apiSuccess(await listApiTokens({ userId: user.id }));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/settings/api-tokens", method: "GET" });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, CreateApiTokenSchema);
    return apiCreated(await createApiToken({ userId: user.id, ...input }));
  } catch (error) {
    return toErrorResponse(error, { requestId, route: "/api/settings/api-tokens", method: "POST" });
  }
}
