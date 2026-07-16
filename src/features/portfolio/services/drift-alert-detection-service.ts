import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { createNotification } from "@/features/notifications/services/notification-service";
import { calculateDrift } from "@/features/portfolio/services/portfolio-drift-service";
import { buildDriftAlertMessage } from "@/features/portfolio/services/drift-alert-messages";
import type { PortfolioTarget } from "@/features/portfolio/services/portfolio-target-service";

const STALE_AFTER_HOURS = 26;

function isStalePrice(value: unknown) {
  if (typeof value !== "string" || !value) return true;
  const timestamp = Date.parse(value);
  return !Number.isFinite(timestamp) || Date.now() - timestamp > STALE_AFTER_HOURS * 60 * 60 * 1000;
}

function eventKey(targetType: string, targetKey: string | null) {
  return targetKey ?? "__cash__";
}

export async function detectDriftForPortfolio(params: {
  userId: string;
  portfolioId: string;
  quoteDate?: string;
}) {
  const db = await createDatabaseClient();
  const quoteDate = params.quoteDate ?? new Date().toISOString().slice(0, 10);
  const { data: portfolio, error: portfolioError } = await db
    .from("portfolios")
    .select("id, cash_amount")
    .eq("id", params.portfolioId)
    .eq("user_id", params.userId)
    .single();
  if (portfolioError || !portfolio) {
    throw new AppError("NOT_FOUND", "ポートフォリオが見つかりません。", 404);
  }

  const [{ data: targets, error: targetsError }, { data: positions, error: positionsError }] =
    await Promise.all([
      db
        .from("portfolio_targets")
        .select("*")
        .eq("portfolio_id", params.portfolioId)
        .eq("user_id", params.userId),
      db
        .from("portfolio_positions")
        .select("ticker, market_value, price_updated_at, position_status")
        .eq("portfolio_id", params.portfolioId)
        .eq("user_id", params.userId)
        .neq("position_status", "archived"),
    ]);
  if (targetsError || positionsError) {
    throw new AppError("INTERNAL_ERROR", "ドリフト計算に必要なデータの取得に失敗しました。", 500, {
      targetsError,
      positionsError,
    });
  }

  const portfolioPositions = (positions ?? []) as Array<{
    ticker: unknown;
    market_value: unknown;
    price_updated_at: unknown;
  }>;
  const findings = calculateDrift({
    cashJpy: Number(portfolio.cash_amount ?? 0),
    positions: portfolioPositions.map((position) => ({
      symbol: String(position.ticker),
      valuationJpy: Number(position.market_value ?? 0),
      stale: isStalePrice(position.price_updated_at),
    })),
    targets: (targets ?? []) as PortfolioTarget[],
  });

  let createdCount = 0;
  for (const finding of findings) {
    const key = eventKey(finding.targetType, finding.targetKey);
    const { data: currentEvent, error: currentEventError } = await db
      .from("drift_alert_events")
      .select("id, status")
      .eq("portfolio_id", params.portfolioId)
      .eq("target_type", finding.targetType)
      .eq("target_key", key)
      .eq("quote_date", quoteDate)
      .maybeSingle();
    if (currentEventError) throw currentEventError;

    if (!finding.exceeded) {
      if (!currentEvent) {
        await db.from("drift_alert_events").insert({
          user_id: params.userId,
          portfolio_id: params.portfolioId,
          target_type: finding.targetType,
          target_key: key,
          quote_date: quoteDate,
          status: "resolved",
        });
      }
      continue;
    }

    if (currentEvent?.status === "notified") continue;

    const { data: previousEvent, error: previousEventError } = await db
      .from("drift_alert_events")
      .select("id, status")
      .eq("portfolio_id", params.portfolioId)
      .eq("target_type", finding.targetType)
      .eq("target_key", key)
      .order("quote_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousEventError) throw previousEventError;
    if (previousEvent?.status === "notified") continue;

    const notification = await createNotification({
      userId: params.userId,
      notificationType: "portfolio_drift_exceeded",
      title: "ポートフォリオの目標比率を確認してください",
      body: buildDriftAlertMessage({
        finding,
        hasStaleData: findings.hasStaleData,
      }),
      severity: "warning",
      targetType: "portfolio",
      targetId: params.portfolioId,
      actionUrl: "/portfolio/targets",
      metadata: { quoteDate, targetType: finding.targetType, targetKey: finding.targetKey },
    });

    if (currentEvent) {
      await db
        .from("drift_alert_events")
        .update({ status: "notified" })
        .eq("id", currentEvent.id)
        .eq("user_id", params.userId);
    } else {
      await db.from("drift_alert_events").insert({
        user_id: params.userId,
        portfolio_id: params.portfolioId,
        target_type: finding.targetType,
        target_key: key,
        quote_date: quoteDate,
        status: "notified",
        notification_id: notification.notification.id,
      });
    }
    createdCount += 1;
  }

  return { createdCount, findings, hasStaleData: findings.hasStaleData };
}

export async function detectDriftForAllPortfolios(params?: { quoteDate?: string }) {
  const db = await createDatabaseClient();
  const { data: targets, error } = await db
    .from("portfolio_targets")
    .select("user_id, portfolio_id")
    .limit(5000);
  if (error) throw error;

  const portfolios = new Map<string, { userId: string; portfolioId: string }>();
  for (const target of targets ?? []) {
    portfolios.set(`${target.user_id}:${target.portfolio_id}`, {
      userId: String(target.user_id),
      portfolioId: String(target.portfolio_id),
    });
  }

  let createdCount = 0;
  for (const portfolio of portfolios.values()) {
    const result = await detectDriftForPortfolio({ ...portfolio, quoteDate: params?.quoteDate });
    createdCount += result.createdCount;
  }
  return { portfolioCount: portfolios.size, createdCount };
}
