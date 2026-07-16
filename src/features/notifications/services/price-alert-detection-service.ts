import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { TradeRuleSchema, type TradeRule } from "@/schemas/rules/trade-rule-schema";
import { createNotification } from "@/features/notifications/services/notification-service";
import {
  buildPriceAlertMessage,
  buildStalePriceAlertMessage,
  type PriceAlertConditionKey,
} from "@/features/notifications/constants/price-alert-messages";

type PriceQuote = {
  symbol: string;
  market?: string;
  quote_date: string;
  close_price?: number | string | null;
  price?: number | string | null;
  close?: number | string | null;
};

type AlertCandidate = {
  conditionKey: Exclude<PriceAlertConditionKey, "price_data_stale">;
  threshold?: number;
  targetPrice?: number;
  dailyDropPercent?: number;
  cooldownHours?: number;
  isTriggered: boolean;
  wasTriggered: boolean;
};

export async function detectPriceAlerts(params: {
  userId: string;
}): Promise<{
  createdCount: number;
  skippedRuleCount: number;
}> {
  const db = await createDatabaseClient();
  const { data: sessions, error: sessionsError } = await db
    .from("rule_design_sessions")
    .select("id, ticker, company_name, market, rule_json, status")
    .eq("user_id", params.userId)
    .in("status", ["finalized", "quality_gate_passed", "approved"])
    .limit(500);

  if (sessionsError) {
    throw new AppError(
      "DATABASE_ERROR",
      "価格監視対象の取得に失敗しました。",
      500,
      sessionsError,
    );
  }

  let createdCount = 0;
  let skippedRuleCount = 0;

  for (const session of sessions ?? []) {
    const parsedRule = TradeRuleSchema.safeParse(session.rule_json ?? {});
    if (!parsedRule.success) {
      skippedRuleCount += 1;
      continue;
    }

    const quotes = await listQuotes({
      symbol: session.ticker,
      market: session.market ?? "JP",
    });
    const latest = quotes[0];
    if (!latest) continue;

    const currentPrice = getQuotePrice(latest);
    if (currentPrice === null) continue;

    const previous = quotes[1];
    const previousPrice = previous ? getQuotePrice(previous) : null;
    const historicalQuotes = quotes.filter((quote) =>
      isWithinLastDays(quote.quote_date, latest.quote_date, 365),
    );
    const historicalHigh = Math.max(
      ...historicalQuotes
        .map(getQuotePrice)
        .filter((value): value is number => value !== null),
    );
    const priorHistoricalHigh = Math.max(
      ...quotes
        .slice(1)
        .filter((quote) => isWithinLastDays(quote.quote_date, latest.quote_date, 365))
        .map(getQuotePrice)
        .filter((value): value is number => value !== null),
    );

    const position = await findPosition({
      userId: params.userId,
      ticker: session.ticker,
      market: session.market ?? "JP",
    });
    const candidates = buildCandidates({
      rule: parsedRule.data,
      currentPrice,
      previousPrice,
      historicalHigh: Number.isFinite(historicalHigh) ? historicalHigh : null,
      priorHistoricalHigh: Number.isFinite(priorHistoricalHigh)
        ? priorHistoricalHigh
        : null,
      averageCost: toFiniteNumber(position?.average_cost),
      previousPreviousPrice: quotes[2] ? getQuotePrice(quotes[2]) : null,
    });

    for (const candidate of candidates) {
      if (!candidate.isTriggered || candidate.wasTriggered) continue;
      if (
        await createPriceAlert({
          userId: params.userId,
          session,
          quote: latest,
          price: currentPrice,
          candidate,
        })
      ) {
        createdCount += 1;
      }
    }
  }

  createdCount += await detectStalePriceAlerts({ userId: params.userId });

  return { createdCount, skippedRuleCount };
}

function buildCandidates(params: {
  rule: TradeRule;
  currentPrice: number;
  previousPrice: number | null;
  previousPreviousPrice: number | null;
  historicalHigh: number | null;
  priorHistoricalHigh: number | null;
  averageCost: number | null;
}): AlertCandidate[] {
  const { rule, currentPrice, previousPrice, averageCost } = params;
  const monitoring = rule.monitoring;
  const candidates: AlertCandidate[] = [];

  if (averageCost !== null && monitoring.stopLossReviewPercent !== undefined) {
    const threshold = monitoring.stopLossReviewPercent;
    const thresholdValue = averageCost * (1 - threshold / 100);
    candidates.push({
      conditionKey: "stop_loss_review",
      threshold,
      isTriggered: currentPrice <= thresholdValue,
      wasTriggered:
        params.previousPrice !== null && params.previousPrice <= thresholdValue,
    });
  }

  if (averageCost !== null && monitoring.takeProfitReviewPercent !== undefined) {
    const threshold = monitoring.takeProfitReviewPercent;
    const thresholdValue = averageCost * (1 + threshold / 100);
    candidates.push({
      conditionKey: "take_profit_review",
      threshold,
      isTriggered: currentPrice >= thresholdValue,
      wasTriggered:
        params.previousPrice !== null && params.previousPrice >= thresholdValue,
    });
  }

  if (
    monitoring.drawdownFromHighPercent !== undefined &&
    params.historicalHigh !== null
  ) {
    const threshold = monitoring.drawdownFromHighPercent;
    const thresholdValue = params.historicalHigh * (1 - threshold / 100);
    const previousThresholdValue =
      params.priorHistoricalHigh === null
        ? null
        : params.priorHistoricalHigh * (1 - threshold / 100);
    candidates.push({
      conditionKey: "drawdown_from_high",
      threshold,
      isTriggered: currentPrice <= thresholdValue,
      wasTriggered:
        params.previousPrice !== null &&
        previousThresholdValue !== null &&
        params.previousPrice <= previousThresholdValue,
    });
  }

  const targetPrice = rule.exitPlan.targetPrice;
  if (targetPrice !== undefined) {
    candidates.push({
      conditionKey: "target_price_reached",
      targetPrice,
      isTriggered: currentPrice >= targetPrice,
      wasTriggered: params.previousPrice !== null && params.previousPrice >= targetPrice,
    });
  }

  if (
    monitoring.cooldownDailyDropPercent !== undefined &&
    previousPrice !== null
  ) {
    const dailyDropPercent =
      ((currentPrice - previousPrice) / previousPrice) * 100;
    const threshold = monitoring.cooldownDailyDropPercent;
    const previousDropPercent =
      params.previousPreviousPrice !== null
        ? ((previousPrice - params.previousPreviousPrice) /
            params.previousPreviousPrice) *
          100
        : null;
    candidates.push({
      conditionKey: "cooldown_triggered",
      threshold,
      dailyDropPercent,
      cooldownHours: monitoring.cooldownHours,
      isTriggered: dailyDropPercent <= -threshold,
      wasTriggered:
        previousDropPercent !== null && previousDropPercent <= -threshold,
    });
  }

  return candidates;
}

async function createPriceAlert(params: {
  userId: string;
  session: {
    id: string;
    ticker: string;
    company_name?: string | null;
    market?: string | null;
  };
  quote: PriceQuote;
  price: number;
  candidate: AlertCandidate;
}) {
  const db = await createDatabaseClient();
  const body = buildPriceAlertMessage({
    conditionKey: params.candidate.conditionKey,
    companyName: params.session.company_name,
    ticker: params.session.ticker,
    price: params.price,
    threshold: params.candidate.threshold,
    targetPrice: params.candidate.targetPrice,
    dailyDropPercent: params.candidate.dailyDropPercent,
    cooldownHours: params.candidate.cooldownHours,
  });

  const { data: event, error: eventError } = await db
    .from("rule_alert_events")
    .insert({
      user_id: params.userId,
      session_id: params.session.id,
      condition_key: params.candidate.conditionKey,
      quote_date: params.quote.quote_date,
      triggered_value: params.price,
      threshold_value:
        params.candidate.threshold ?? params.candidate.targetPrice ?? null,
    })
    .select("id")
    .single();

  if (eventError) {
    if (isUniqueConstraintError(eventError.message)) return false;
    throw new AppError("DATABASE_ERROR", "価格アラートの記録に失敗しました。", 500, eventError);
  }
  if (!event) return false;

  const { notification } = await createNotification({
    userId: params.userId,
    notificationType: "rule_price_condition_met",
    title: "価格条件を確認してください",
    body,
    severity: "info",
    targetType: "rule_session",
    targetId: params.session.id,
    actionUrl: `/rules/${params.session.id}`,
    metadata: {
      conditionKey: params.candidate.conditionKey,
      quoteDate: params.quote.quote_date,
      price: params.price,
      threshold:
        params.candidate.threshold ?? params.candidate.targetPrice ?? null,
      ruleAlertEventId: event.id,
    },
  });

  const { error: updateError } = await db
    .from("rule_alert_events")
    .update({ notification_id: notification.id })
    .eq("id", event.id)
    .eq("user_id", params.userId);
  if (updateError) {
    throw new AppError(
      "DATABASE_ERROR",
      "価格アラートと通知の紐付けに失敗しました。",
      500,
      updateError,
    );
  }

  return true;
}

async function detectStalePriceAlerts(params: { userId: string }) {
  const db = await createDatabaseClient();
  const { data: positions, error } = await db
    .from("portfolio_positions")
    .select("id, ticker, company_name, market, rule_session_id, position_status")
    .eq("user_id", params.userId)
    .eq("position_status", "active");
  if (error) {
    throw new AppError("DATABASE_ERROR", "価格更新状態の確認に失敗しました。", 500, error);
  }

  let createdCount = 0;
  for (const position of positions ?? []) {
    const quotes = await listQuotes({
      symbol: position.ticker,
      market: position.market ?? "JP",
    });
    const latest = quotes[0];
    if (!latest) continue;
    const staleDays = getCalendarDayDifference(latest.quote_date);
    if (staleDays < 4) continue;

    const sessionId = position.rule_session_id ?? position.id;
    const { data: event, error: eventError } = await db
      .from("rule_alert_events")
      .insert({
        user_id: params.userId,
        session_id: sessionId,
        condition_key: "price_data_stale",
        quote_date: latest.quote_date,
        triggered_value: getQuotePrice(latest),
      })
      .select("id")
      .single();
    if (eventError) {
      if (isUniqueConstraintError(eventError.message)) continue;
      throw new AppError("DATABASE_ERROR", "価格未更新アラートの記録に失敗しました。", 500, eventError);
    }
    if (!event) continue;

    const { notification } = await createNotification({
      userId: params.userId,
      notificationType: "price_data_stale",
      title: "価格データを確認してください",
      body: buildStalePriceAlertMessage({
        companyName: position.company_name,
        ticker: position.ticker,
        staleDays,
      }),
      severity: "warning",
      targetType: "portfolio_position",
      targetId: position.id,
      actionUrl: "/portfolio",
      metadata: {
        conditionKey: "price_data_stale",
        quoteDate: latest.quote_date,
        staleDays,
        ruleAlertEventId: event.id,
      },
    });
    const { error: updateError } = await db
      .from("rule_alert_events")
      .update({ notification_id: notification.id })
      .eq("id", event.id)
      .eq("user_id", params.userId);
    if (updateError) {
      throw new AppError("DATABASE_ERROR", "価格未更新通知の紐付けに失敗しました。", 500, updateError);
    }
    createdCount += 1;
  }
  return createdCount;
}

async function findPosition(params: {
  userId: string;
  ticker: string;
  market?: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("portfolio_positions")
    .select("average_cost")
    .eq("user_id", params.userId)
    .eq("ticker", params.ticker)
    .eq("position_status", "active")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new AppError("DATABASE_ERROR", "保有銘柄の取得に失敗しました。", 500, error);
  }
  return data;
}

async function listQuotes(params: { symbol: string; market: string }): Promise<PriceQuote[]> {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("price_quotes")
    .select("*")
    .eq("symbol", params.symbol)
    .eq("market", params.market)
    .order("quote_date", { ascending: false })
    .limit(366);
  if (error) {
    throw new AppError("DATABASE_ERROR", "価格履歴の取得に失敗しました。", 500, error);
  }
  return (data ?? []) as PriceQuote[];
}

function getQuotePrice(quote: PriceQuote): number | null {
  return toFiniteNumber(quote.close_price ?? quote.price ?? quote.close);
}

function toFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function isWithinLastDays(date: string, latestDate: string, days: number) {
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  const latestMs = Date.parse(`${latestDate}T00:00:00Z`);
  return Number.isFinite(dateMs) && Number.isFinite(latestMs) && latestMs - dateMs <= days * 86_400_000;
}

function getCalendarDayDifference(date: string) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const quoteMs = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(quoteMs)) return Number.POSITIVE_INFINITY;
  return Math.floor((todayUtc - quoteMs) / 86_400_000);
}

function isUniqueConstraintError(message: string) {
  return /unique|constraint/i.test(message);
}
