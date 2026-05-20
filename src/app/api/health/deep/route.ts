import { apiSuccess, apiError } from "@/lib/api/api-response";
import { createServerClient } from "@/lib/db/supabase-server";
import { recordHealthCheck } from "@/lib/observability/record-health-check";
import { generateRequestId } from "@/lib/observability/request-id";

export async function GET() {
  const requestId = generateRequestId();
  const checks: Array<{
    name: string;
    status: "pass" | "fail" | "warn";
    latencyMs: number;
    message?: string;
  }> = [];

  // DB check
  const dbStart = Date.now();
  try {
    const supabase = await createServerClient();
    const { error } = await supabase.from("app_users").select("id").limit(1);

    const dbLatency = Date.now() - dbStart;

    if (error) {
      checks.push({
        name: "db",
        status: "fail",
        latencyMs: dbLatency,
        message: error.message,
      });
    } else {
      checks.push({ name: "db", status: "pass", latencyMs: dbLatency });
    }

    void recordHealthCheck({
      checkName: "db",
      status: error ? "fail" : "pass",
      latencyMs: dbLatency,
      message: error?.message ?? null,
    });
  } catch (err) {
    const dbLatency = Date.now() - dbStart;
    const message = err instanceof Error ? err.message : "Unknown DB error";
    checks.push({ name: "db", status: "fail", latencyMs: dbLatency, message });

    void recordHealthCheck({
      checkName: "db",
      status: "fail",
      latencyMs: dbLatency,
      message,
    });
  }

  const allPass = checks.every((c) => c.status === "pass");

  if (!allPass) {
    const failed = checks.filter((c) => c.status !== "pass");
    return apiError(
      "HEALTH_CHECK_FAILED",
      `Health check failed: ${failed.map((f) => f.name).join(", ")}`,
      requestId,
      503,
    );
  }

  return apiSuccess({
    status: "ok",
    checks,
    timestamp: new Date().toISOString(),
  });
}
