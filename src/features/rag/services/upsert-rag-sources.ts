import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { upsertRagDocument } from "@/features/rag/services/upsert-rag-document";
import {
  buildRuleSessionRagContent,
  buildWatchlistItemRagContent,
  buildPortfolioPositionRagContent,
} from "@/features/rag/services/build-rag-document";
import { AppError } from "@/lib/errors/app-error";

export async function upsertRagDocumentFromRuleSession(params: {
  userId: string;
  sessionId: string;
}) {
  const db = await createDatabaseClient();

  const { data: session, error } = await db
    .from("rule_design_sessions")
    .select("*")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();

  if (error || !session) {
    throw new AppError(
      "NOT_FOUND",
      "ルールセッションが見つかりません。",
      404,
      error,
    );
  }

  return upsertRagDocument({
    userId: params.userId,
    sourceType: "rule_session",
    sourceId: session.id,
    title: `${session.ticker} ${session.company_name ?? ""} Rule Session`,
    content: buildRuleSessionRagContent(session),
    metadata: {
      ticker: session.ticker,
      companyName: session.company_name,
      status: session.status,
      completionScore: session.completion_score,
    },
  });
}

export async function upsertRagDocumentFromWatchlistItem(params: {
  userId: string;
  itemId: string;
}) {
  const db = await createDatabaseClient();

  const { data: item, error } = await db
    .from("watchlist_items")
    .select("*")
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .single();

  if (error || !item) {
    throw new AppError(
      "NOT_FOUND",
      "Watchlistアイテムが見つかりません。",
      404,
      error,
    );
  }

  return upsertRagDocument({
    userId: params.userId,
    sourceType: "watchlist_item",
    sourceId: item.id,
    title: `${item.ticker} ${item.company_name ?? ""} Watchlist Item`,
    content: buildWatchlistItemRagContent(item),
    metadata: {
      ticker: item.ticker,
      companyName: item.company_name,
      status: item.status,
      priority: item.priority,
    },
  });
}

export async function upsertRagDocumentFromPortfolioPosition(params: {
  userId: string;
  positionId: string;
}) {
  const db = await createDatabaseClient();

  const { data: position, error } = await db
    .from("portfolio_positions")
    .select("*")
    .eq("id", params.positionId)
    .eq("user_id", params.userId)
    .single();

  if (error || !position) {
    throw new AppError(
      "NOT_FOUND",
      "Portfolioポジションが見つかりません。",
      404,
      error,
    );
  }

  return upsertRagDocument({
    userId: params.userId,
    sourceType: "portfolio_position",
    sourceId: position.id,
    title: `${position.ticker} ${position.company_name ?? ""} Portfolio Position`,
    content: buildPortfolioPositionRagContent(position),
    metadata: {
      ticker: position.ticker,
      companyName: position.company_name,
      sector: position.sector,
      theme: position.theme,
    },
  });
}
