import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { requireUser } from "@/lib/auth/require-user";
import { createDatabaseClient } from "@/lib/db/database-client";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import {
  addThesisResearchSource,
  listThesisResearchSources,
} from "@/features/rules/services/thesis-research-source-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return handleRequest(request, params, async ({ userId, sessionId }) => {
    const db = await createDatabaseClient();
    const { data: session, error } = await db
      .from("rule_design_sessions")
      .select("ticker, market")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();
    if (error || !session) throw error ?? new Error("rule session was not found");

    const sources = await listThesisResearchSources({
      userId,
      ticker: String(session.ticker),
      market: String(session.market ?? "JP"),
    });
    return apiSuccess({ sources });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return handleRequest(request, params, async ({ userId, sessionId }) => {
    const input = (await request.json()) as Record<string, unknown>;
    const db = await createDatabaseClient();
    const { data: session, error } = await db
      .from("rule_design_sessions")
      .select("ticker, market")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();
    if (error || !session) throw error ?? new Error("rule session was not found");

    const source = await addThesisResearchSource({
      userId,
      input: {
        ticker: String(session.ticker),
        market: String(session.market ?? "JP"),
        sourceType: input.sourceType as "company_ir" | "primary",
        url: String(input.url ?? ""),
        title: String(input.title ?? ""),
        publisher: String(input.publisher ?? ""),
        publishedAt:
          input.publishedAt == null ? null : String(input.publishedAt),
      },
    });
    return apiCreated({ source });
  });
}

async function handleRequest(
  request: Request,
  paramsPromise: Promise<{ sessionId: string }>,
  handler: (params: { userId: string; sessionId: string }) => Promise<Response>,
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;
  try {
    const user = await requireUser();
    userId = user.id;
    const { sessionId } = await paramsPromise;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    return await handler({ userId: user.id, sessionId });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: new URL(request.url).pathname,
      method: request.method,
    });
  }
}
