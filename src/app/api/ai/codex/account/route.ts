import { requireUser } from "@/lib/auth/require-user";
import {
  readCodexAccount,
  type CodexAccountStatus,
} from "@/lib/ai/providers/codex-app-server-provider";
import { assertCodexAppServerLocalOnly } from "@/lib/ai/codex-app-server-access";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    assertCodexAppServerLocalOnly();

    const account: CodexAccountStatus = await readCodexAccount();
    return apiSuccess(account);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai/codex/account",
      method: "GET",
    });
  }
}
