import { requireUser } from "@/lib/auth/require-user";
import {
  startCodexChatGPTLogin,
  type CodexAppServerLoginMode,
} from "@/lib/ai/providers/codex-app-server-provider";
import { assertCodexAppServerLocalOnly } from "@/lib/ai/codex-app-server-access";
import { apiSuccess } from "@/lib/api/api-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LoginRequestSchema = z.object({
  mode: z.enum(["browser", "device-code"]).default("browser"),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    assertCodexAppServerLocalOnly();

    const input = await validateJsonRequest(request, LoginRequestSchema);
    const login = await startCodexChatGPTLogin(
      input.mode as CodexAppServerLoginMode,
    );

    return apiSuccess(login);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai/codex/login",
      method: "POST",
    });
  }
}
