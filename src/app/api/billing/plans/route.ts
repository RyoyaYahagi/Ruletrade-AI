import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDatabaseClient } from "@/lib/db/database-client";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const db = await createDatabaseClient();
    const { data, error } = await db
      .from("billing_plans")
      .select("*")
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

    if (error) throw error;

    return apiSuccess({ plans: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/billing/plans",
      method: "GET",
    });
  }
}
