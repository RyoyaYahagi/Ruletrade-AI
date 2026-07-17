import { requireAdmin } from "@/lib/auth/require-admin";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { createDatabaseClient } from "@/lib/db/database-client";
import { ManualFinancialStatementSchema } from "@/schemas/financials/financial-statement-schema";
import { upsertFinancialStatement } from "@/features/financials/services/financial-statement-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const db = await createDatabaseClient();
    const { data, error } = await db
      .from("financial_statements")
      .select("*")
      .order("fiscal_period", { ascending: false });
    if (error) throw error;
    return apiSuccess({ statements: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/financials",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const input = await validateJsonRequest(request, ManualFinancialStatementSchema);
    return apiCreated(
      await upsertFinancialStatement({ statement: input, source: "manual" }),
    );
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/financials",
      method: "POST",
    });
  }
}
