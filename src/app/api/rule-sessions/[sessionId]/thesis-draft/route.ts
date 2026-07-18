import { requireUser } from "@/lib/auth/require-user";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import {
  applyFallbackBreakerCandidates,
  generateThesisDraft,
} from "@/features/rules/services/thesis-draft-service";
import type { ThesisDraftPhase } from "@/features/rules/services/thesis-draft-service";
import { AppError } from "@/lib/errors/app-error";
import { trackRuleFunnelEvent } from "@/features/rules/services/rule-analytics-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;
  try {
    const user = await requireUser();
    userId = user.id;
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });

    return createDraftStream({ userId: user.id, sessionId, requestId });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: new URL(request.url).pathname,
      method: request.method,
    });
  }
}

function createDraftStream(params: {
  userId: string;
  sessionId: string;
  requestId: string;
}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      void (async () => {
        try {
          await recordDraftEvent({
            ...params,
            eventName: "thesis_draft_requested",
          });
          const result = await generateThesisDraft({
            ...params,
            onPhase: (phase) =>
              send("phase", { phase, label: phaseLabel(phase) }),
          });
          await recordDraftEvent({
            ...params,
            eventName: "thesis_draft_succeeded",
            metadata: { traceId: result.traceId ?? null },
          });
          send("completed", { ...result, fallbackUsed: false });
        } catch (error) {
          await recordDraftEvent({
            ...params,
            eventName: "thesis_draft_failed",
            metadata: {
              errorCode: error instanceof AppError ? error.code : "PROCESSING_FAILED",
            },
          });
          if (error instanceof AppError && error.code === "AI_OUTPUT_INVALID") {
            const breakerCandidates = await applyFallbackBreakerCandidates(params);
            send("completed", {
              thesisDraft: "",
              thesisSegments: [],
              evidence: [],
              breakerCandidates,
              research: null,
              fallbackUsed: true,
              notice: error.message,
            });
          } else {
            send("error", {
              code: error instanceof AppError ? error.code : "PROCESSING_FAILED",
              message:
                error instanceof AppError
                  ? error.message
                  : "企業調査付きの下書きを作成できませんでした。",
            });
          }
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function recordDraftEvent(params: {
  userId: string;
  sessionId: string;
  requestId: string;
  eventName:
    | "thesis_draft_requested"
    | "thesis_draft_succeeded"
    | "thesis_draft_failed";
  metadata?: Record<string, unknown>;
}) {
  try {
    await trackRuleFunnelEvent(params);
  } catch (error) {
    console.error("Failed to record thesis draft analytics event:", error);
  }
}

function phaseLabel(phase: ThesisDraftPhase) {
  const labels = {
    researching_company: "企業情報を確認中",
    researching_financials: "決算・財務情報を整理中",
    researching_news: "ニュースと短期要因を整理中",
    drafting: "仮説を作成中",
    verifying_sources: "出典箇所を確認中",
    completed: "下書きが完成しました",
  } as const;
  return labels[phase];
}
