import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  FinancialSourceSchema,
  FinancialStatementSchema,
  financialPeriodKey,
  type FinancialSource,
  type FinancialStatement,
} from "@/schemas/financials/financial-statement-schema";

export async function upsertFinancialStatement(params: {
  statement: FinancialStatement;
  source: FinancialSource;
}) {
  const statementResult = FinancialStatementSchema.safeParse(params.statement);
  const sourceResult = FinancialSourceSchema.safeParse(params.source);
  if (!statementResult.success || !sourceResult.success) {
    throw new AppError("VALIDATION_ERROR", "財務数値の形式が正しくありません。", 400);
  }

  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("financial_statements")
    .upsert(
      {
        ticker: statementResult.data.ticker,
        market: statementResult.data.market,
        fiscal_period: statementResult.data.fiscalPeriod,
        revenue: statementResult.data.revenue,
        operating_income: statementResult.data.operatingIncome,
        net_income: statementResult.data.netIncome,
        eps: statementResult.data.eps,
        dividend_per_share: statementResult.data.dividendPerShare,
        equity_ratio: statementResult.data.equityRatio,
        currency: statementResult.data.currency,
        source: sourceResult.data,
        filed_at: statementResult.data.filedAt,
      },
      { onConflict: "ticker,market,fiscal_period,source" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("DATABASE_ERROR", "財務数値の保存に失敗しました。", 500, error);
  }
  return { statement: data };
}

export async function listLatestFinancialStatement(params: {
  ticker: string;
  market?: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("financial_statements")
    .select("*")
    .eq("ticker", params.ticker)
    .eq("market", params.market ?? "JP");
  if (error) {
    throw new AppError("DATABASE_ERROR", "最新の財務数値の取得に失敗しました。", 500, error);
  }

  const latest = [...(data ?? [])].sort(
    (left, right) =>
      financialPeriodKey(String(right.fiscal_period)) -
      financialPeriodKey(String(left.fiscal_period)),
  )[0] ?? null;
  return { statement: latest };
}

export function toFinancialStatementInput(row: Record<string, unknown>): FinancialStatement {
  return FinancialStatementSchema.parse({
    ticker: String(row.ticker),
    market: String(row.market ?? "JP"),
    fiscalPeriod: String(row.fiscal_period),
    revenue: nullableNumber(row.revenue),
    operatingIncome: nullableNumber(row.operating_income),
    netIncome: nullableNumber(row.net_income),
    eps: nullableNumber(row.eps),
    dividendPerShare: nullableNumber(row.dividend_per_share),
    equityRatio: nullableNumber(row.equity_ratio),
    currency: String(row.currency ?? "JPY"),
    filedAt: row.filed_at == null ? null : String(row.filed_at),
  });
}

function nullableNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
