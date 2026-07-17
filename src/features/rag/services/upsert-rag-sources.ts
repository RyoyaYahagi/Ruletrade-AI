import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { upsertRagDocument } from "@/features/rag/services/upsert-rag-document";
import {
  buildRuleSessionRagContent,
  buildWatchlistItemRagContent,
  buildPortfolioPositionRagContent,
  buildAlertResolutionRagContent,
  buildNewsAssessmentRagContent,
  buildHolisticReviewRagContent,
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

export async function upsertRagDocumentFromAlertResolution(params: {
  userId: string;
  eventId: string;
}) {
  const db = await createDatabaseClient();
  const { data: event, error } = await db
    .from("rule_alert_events")
    .select("*")
    .eq("id", params.eventId)
    .eq("user_id", params.userId)
    .single();
  if (error || !event || !event.resolution) {
    throw new AppError("NOT_FOUND", "ルール条件の判断記録が見つかりません。", 404, error);
  }

  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("ticker")
    .eq("id", event.session_id)
    .eq("user_id", params.userId)
    .single();
  if (sessionError || !session) {
    throw new AppError("NOT_FOUND", "判断記録のルールセッションが見つかりません。", 404, sessionError);
  }

  return upsertRagDocument({
    userId: params.userId,
    sourceType: "alert_resolution",
    sourceId: event.id,
    title: `${session.ticker} alert resolution ${event.quote_date}`,
    content: buildAlertResolutionRagContent({
      quoteDate: String(event.quote_date),
      ticker: String(session.ticker),
      conditionKey: String(event.condition_key),
      resolution: event.resolution,
    }),
    metadata: {
      ticker: session.ticker,
      quoteDate: event.quote_date,
      resolution: event.resolution,
    },
  });
}

export async function upsertRagDocumentFromNewsAssessment(params: {
  userId: string;
  assessmentId: string;
}) {
  const db = await createDatabaseClient();
  const { data: assessment, error } = await db
    .from("news_assessments")
    .select("*")
    .eq("id", params.assessmentId)
    .eq("user_id", params.userId)
    .single();
  if (error || !assessment) {
    throw new AppError("NOT_FOUND", "ニュース判定記録が見つかりません。", 404, error);
  }

  const [{ data: article }, { data: session }] = await Promise.all([
    db
      .from("news_items")
      .select("title, published_at")
      .eq("id", assessment.news_item_id)
      .single(),
    db
      .from("rule_design_sessions")
      .select("ticker, rule_json")
      .eq("id", assessment.session_id)
      .eq("user_id", params.userId)
      .single(),
  ]);
  if (!article || !session) {
    throw new AppError("NOT_FOUND", "ニュース判定の参照元が見つかりません。", 404);
  }

  const thesis =
    typeof session.rule_json === "object" && session.rule_json !== null
      ? String(
          (session.rule_json as { investmentThesis?: unknown }).investmentThesis ??
            "",
        )
      : "";
  return upsertRagDocument({
    userId: params.userId,
    sourceType: "news_assessment",
    sourceId: assessment.id,
    title: `${session.ticker} news assessment ${assessment.created_at}`,
    content: buildNewsAssessmentRagContent({
      publishedAt: String(article.published_at),
      ticker: String(session.ticker),
      title: String(article.title),
      thesis,
      thesisRelation: assessment.thesis_relation,
      summary: assessment.summary_text,
    }),
    metadata: {
      ticker: session.ticker,
      sessionId: assessment.session_id,
      articleId: assessment.news_item_id,
    },
  });
}

export async function upsertRagDocumentFromHolisticReview(params: {
  userId: string;
  reviewId: string;
}) {
  const db = await createDatabaseClient();
  const { data: review, error } = await db
    .from("holistic_reviews")
    .select("*")
    .eq("id", params.reviewId)
    .eq("user_id", params.userId)
    .single();
  if (error || !review) {
    throw new AppError("NOT_FOUND", "月次レビューが見つかりません。", 404, error);
  }

  const reviewJson =
    typeof review.review_json === "object" && review.review_json !== null
      ? (review.review_json as {
          findings?: Array<{
            category?: unknown;
            status?: unknown;
            message?: unknown;
            relatedSymbols?: unknown;
          }>;
        })
      : {};
  const findings = (reviewJson.findings ?? []).map((finding) => ({
    category: String(finding.category ?? "unknown"),
    status: String(finding.status ?? "unknown"),
    message: String(finding.message ?? ""),
    relatedSymbols: Array.isArray(finding.relatedSymbols)
      ? finding.relatedSymbols.map(String)
      : [],
  }));

  return upsertRagDocument({
    userId: params.userId,
    sourceType: "holistic_review",
    sourceId: review.id,
    title: `Holistic review ${review.period}`,
    content: buildHolisticReviewRagContent({
      period: String(review.period),
      summaryText: String(review.summary_text),
      findings,
    }),
    metadata: { period: review.period },
  });
}
