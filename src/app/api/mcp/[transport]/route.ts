import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import { getAiUsageSummary } from "@/features/ai/services/ai-usage-service";
import { recordApiToolAudit } from "@/features/auth/services/api-token-service";
import { getPortfolio } from "@/features/portfolio/services/portfolio-service";
import { listPortfolioPositions } from "@/features/portfolio/services/portfolio-position-service";
import { getNextQuestion } from "@/features/rules/services/rule-question-service";
import {
  createRuleSession,
  getRuleSessionDetail,
  listRuleSessions,
} from "@/features/rules/services/rule-session-service";
import { saveRuleAnswer } from "@/features/rules/services/rule-answer-service";
import { listNotifications } from "@/features/notifications/services/notification-service";
import { createWatchlistItem, listWatchlistItems } from "@/features/watchlist/services/watchlist-item-service";
import { listTodayFeed } from "@/features/ux/services/today-feed-service";
import { requireTokenUser } from "@/lib/auth/require-token-user";
import {
  requireMcpTokenContext,
  runWithMcpTokenContext,
} from "@/lib/auth/mcp-token-context";
import { AppError } from "@/lib/errors/app-error";
import { toErrorResponse } from "@/lib/errors/to-error-response";

export const runtime = "nodejs";

const NO_ADVICE_SUFFIX =
  " This tool never provides investment advice. Rule approval must be done by the human user in the web UI.";

export const MCP_TOOL_NAMES = [
  "list_rule_sessions",
  "get_rule_session",
  "get_next_question",
  "answer_question",
  "create_rule_session",
  "get_portfolio",
  "list_watchlist",
  "add_watchlist_item",
  "list_notifications",
  "get_today_items",
  "get_ai_usage_summary",
] as const;

const mcpHandler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_rule_sessions",
      {
        title: "List rule sessions",
        description: `List the authenticated user's rule sessions and their statuses.${NO_ADVICE_SUFFIX}`,
        inputSchema: {},
      },
      () => runMcpTool("list_rule_sessions", "read", (context) =>
        listRuleSessions({ userId: context.userId }),
      ),
    );

    server.registerTool(
      "get_rule_session",
      {
        title: "Get rule session",
        description: `Get one owned rule session, including its draft rule JSON.${NO_ADVICE_SUFFIX}`,
        inputSchema: { sessionId: z.string().min(1) },
      },
      ({ sessionId }) =>
        runMcpTool("get_rule_session", "read", (context) =>
          getRuleSessionDetail({ userId: context.userId, sessionId }),
        ),
    );

    server.registerTool(
      "get_next_question",
      {
        title: "Get next rule question",
        description: `Get the next unanswered question for an owned rule session.${NO_ADVICE_SUFFIX}`,
        inputSchema: { sessionId: z.string().min(1) },
      },
      ({ sessionId }) =>
        runMcpTool("get_next_question", "read", (context) =>
          getNextQuestion({ userId: context.userId, sessionId }),
        ),
    );

    server.registerTool(
      "answer_question",
      {
        title: "Answer a rule question",
        description: `Save a human-provided answer as an agent-entered draft. The answer is marked enteredBy=api_agent and must be reviewed in the web UI.${NO_ADVICE_SUFFIX}`,
        inputSchema: {
          sessionId: z.string().min(1),
          questionId: z.string().optional(),
          questionKey: z.string().min(1),
          answerText: z.string().optional(),
          answerJson: z.record(z.string(), z.unknown()).default({}),
        },
      },
      ({ sessionId, questionId, questionKey, answerText, answerJson }) =>
        runMcpTool("answer_question", "write", (context) =>
          saveRuleAnswer({
            userId: context.userId,
            sessionId,
            questionId,
            questionKey,
            answerText,
            answerJson,
            enteredBy: "api_agent",
          }),
        ),
    );

    server.registerTool(
      "create_rule_session",
      {
        title: "Create a rule session",
        description: `Create a draft rule session for the authenticated user. This does not approve or finalize the rule.${NO_ADVICE_SUFFIX}`,
        inputSchema: {
          ticker: z.string().min(1),
          companyName: z.string().optional(),
          market: z.string().optional(),
          currency: z.string().optional(),
        },
      },
      ({ ticker, companyName, market, currency }) =>
        runMcpTool("create_rule_session", "write", (context) =>
          createRuleSession({
            userId: context.userId,
            ticker,
            companyName,
            market,
            currency,
          }),
        ),
    );

    server.registerTool(
      "get_portfolio",
      {
        title: "Get portfolio",
        description: `Get the authenticated user's portfolio and positions with the current as-of date when available.${NO_ADVICE_SUFFIX}`,
        inputSchema: {},
      },
      () =>
        runMcpTool("get_portfolio", "read", async (context) => ({
          ...(await getPortfolio({ userId: context.userId })),
          ...(await listPortfolioPositions({ userId: context.userId })),
          asOf: new Date().toISOString(),
        })),
    );

    server.registerTool(
      "list_watchlist",
      {
        title: "List watchlist",
        description: `List the authenticated user's active watchlist items.${NO_ADVICE_SUFFIX}`,
        inputSchema: {},
      },
      () => runMcpTool("list_watchlist", "read", (context) =>
        listWatchlistItems({ userId: context.userId }),
      ),
    );

    server.registerTool(
      "add_watchlist_item",
      {
        title: "Add watchlist item",
        description: `Add a ticker to the authenticated user's watchlist. This records a draft watchlist item and does not execute any trade.${NO_ADVICE_SUFFIX}`,
        inputSchema: {
          ticker: z.string().min(1),
          companyName: z.string().optional(),
          market: z.string().optional(),
          currency: z.string().default("JPY"),
          interestReason: z.string().optional(),
          researchNotes: z.string().optional(),
        },
      },
      ({ ticker, companyName, market, currency, interestReason, researchNotes }) =>
        runMcpTool("add_watchlist_item", "write", (context) =>
          createWatchlistItem({
            userId: context.userId,
            ticker,
            companyName,
            market,
            currency,
            interestReason,
            researchNotes,
          }),
        ),
    );

    server.registerTool(
      "list_notifications",
      {
        title: "List notifications",
        description: `List the authenticated user's notifications without marking them as read or resolving them.${NO_ADVICE_SUFFIX}`,
        inputSchema: {},
      },
      () => runMcpTool("list_notifications", "read", (context) =>
        listNotifications({ userId: context.userId, limit: 50 }),
      ),
    );

    server.registerTool(
      "get_today_items",
      {
        title: "Get today's items",
        description: `Get the authenticated user's Today feed and confirmation items.${NO_ADVICE_SUFFIX}`,
        inputSchema: {},
      },
      () => runMcpTool("get_today_items", "read", (context) =>
        listTodayFeed({ userId: context.userId }),
      ),
    );

    server.registerTool(
      "get_ai_usage_summary",
      {
        title: "Get AI usage summary",
        description: `Get the authenticated user's current AI usage and budget summary.${NO_ADVICE_SUFFIX}`,
        inputSchema: {},
      },
      () => runMcpTool("get_ai_usage_summary", "read", (context) =>
        getAiUsageSummary(context.userId),
      ),
    );
  },
  {
    serverInfo: { name: "ruletrade-ai", version: "0.1.0" },
  },
  {
    basePath: "/api",
    disableSse: true,
    maxDuration: 60,
  },
);

async function runMcpTool<T>(
  toolName: string,
  requiredScope: "read" | "write",
  operation: (context: ReturnType<typeof requireMcpTokenContext>) => Promise<T>,
) {
  const context = requireMcpTokenContext(requiredScope);
  const startedAt = Date.now();

  try {
    const result = await operation(context);
    await recordApiToolAudit({
      userId: context.userId,
      tokenId: context.tokenId,
      toolName,
      status: "success",
      latencyMs: Date.now() - startedAt,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  } catch (error) {
    await recordApiToolAudit({
      userId: context.userId,
      tokenId: context.tokenId,
      toolName,
      status: "error",
      latencyMs: Date.now() - startedAt,
    });
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: error instanceof AppError ? error.message : "ツールを実行できませんでした。",
        },
      ],
    };
  }
}

async function authenticatedMcpHandler(request: Request) {
  try {
    const tokenContext = await requireTokenUser(request, "read");
    return await runWithMcpTokenContext(tokenContext, () => mcpHandler(request));
  } catch (error) {
    return toErrorResponse(error, {
      requestId: crypto.randomUUID(),
      route: "/api/mcp",
      method: request.method,
    });
  }
}

export const GET = authenticatedMcpHandler;
export const POST = authenticatedMcpHandler;
export const DELETE = authenticatedMcpHandler;
