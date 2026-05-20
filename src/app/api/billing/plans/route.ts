import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createServerClient } from "@/lib/db/supabase-server";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
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
