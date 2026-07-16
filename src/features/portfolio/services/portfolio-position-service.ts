import "server-only";

import { createHash } from "node:crypto";
import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { getOrCreateMainPortfolio } from "@/features/portfolio/services/portfolio-service";

export async function listPortfolioPositions(params: { userId: string }) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", params.userId)
    .neq("position_status", "archived")
    .order("market_value", {
      ascending: false,
    });

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "保有銘柄一覧の取得に失敗しました。",
      500,
      error,
    );
  }

  return {
    positions: data ?? [],
  };
}

export async function createPortfolioPosition(params: {
  userId: string;
  ticker?: string;
  companyName?: string;
  market?: string;
  currency: string;
  assetType: string;
  sector?: string;
  theme?: string;
  quantity?: number;
  averageCost?: number;
  currentPrice?: number;
  marketValue: number;
  targetWeightPercent?: number;
  ruleSessionId?: string;
  positionStatus?: string;
  memo?: string;
}) {
  const db = await createDatabaseClient();

  const { portfolio } = await getOrCreateMainPortfolio({
    userId: params.userId,
  });

  const { data, error } = await db
    .from("portfolio_positions")
    .insert({
      user_id: params.userId,
      portfolio_id: portfolio.id,
      ticker: normalizePositionTicker(params),
      company_name: params.companyName ?? null,
      market: params.market ?? null,
      currency: params.currency,
      asset_type: params.assetType,
      sector: params.sector ?? null,
      theme: params.theme ?? null,
      quantity: params.quantity ?? null,
      average_cost: params.averageCost ?? null,
      current_price: params.currentPrice ?? null,
      market_value: params.marketValue,
      target_weight_percent: params.targetWeightPercent ?? null,
      rule_session_id: params.ruleSessionId ?? null,
      position_status: params.positionStatus ?? "active",
      memo: params.memo ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "保有銘柄の追加に失敗しました。",
      500,
      error,
    );
  }

  return {
    position: data,
  };
}

export async function createPortfolioPositions(params: {
  userId: string;
  positions: Array<{
    ticker?: string;
    companyName?: string;
    market?: string;
    currency: string;
    assetType: string;
    sector?: string;
    theme?: string;
    quantity?: number;
    averageCost?: number;
    currentPrice?: number;
    marketValue: number;
    targetWeightPercent?: number;
    ruleSessionId?: string;
    positionStatus?: string;
    memo?: string;
  }>;
}) {
  const db = await createDatabaseClient();
  const { portfolio } = await getOrCreateMainPortfolio({
    userId: params.userId,
  });

  const rows = params.positions.map((position) => ({
    user_id: params.userId,
    portfolio_id: portfolio.id,
    ticker: normalizePositionTicker(position),
    company_name: position.companyName ?? null,
    market: position.market ?? null,
    currency: position.currency,
    asset_type: position.assetType,
    sector: position.sector ?? null,
    theme: position.theme ?? null,
    quantity: position.quantity ?? null,
    average_cost: position.averageCost ?? null,
    current_price: position.currentPrice ?? null,
    market_value: position.marketValue,
    target_weight_percent: position.targetWeightPercent ?? null,
    rule_session_id: position.ruleSessionId ?? null,
    position_status: position.positionStatus ?? "active",
    memo: position.memo ?? null,
  }));

  const { data, error } = await db.from("portfolio_positions").insert(rows);

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "保有銘柄の一括追加に失敗しました。",
      500,
      error,
    );
  }

  return {
    count: rows.length,
    positions: Array.isArray(data) ? data : [],
  };
}

function normalizePositionTicker(params: {
  ticker?: string;
  companyName?: string;
  assetType?: string;
}) {
  const ticker = params.ticker?.trim();
  if (ticker) return ticker;

  const companyName = params.companyName?.trim();
  if (!companyName) {
    throw new AppError(
      "VALIDATION_ERROR",
      "銘柄コードまたは銘柄名を入力してください。",
      400,
    );
  }

  const prefix = params.assetType === "fund" ? "FUND" : "ASSET";
  const digest = createHash("sha256")
    .update(`${params.assetType ?? "other"}:${companyName}`)
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${digest}`;
}
