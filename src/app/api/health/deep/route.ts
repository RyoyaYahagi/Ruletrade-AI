import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      throw new AppError(
        "INTERNAL_ERROR",
        "CRON_SECRET is not configured.",
        500,
      );
    }

    const authHeader = request.headers.get("authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      throw new AppError("UNAUTHORIZED", "Unauthorized.", 401);
    }

    const supabase = await createServerClient();

    const { error } = await supabase
      .from("app_users")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Database check failed.",
        500,
        error,
      );
    }

    return apiSuccess({
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/health/deep",
      method: "GET",
    });
  }
}
