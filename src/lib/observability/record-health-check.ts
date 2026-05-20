import "server-only";
import { createServerClient } from "@/lib/db/supabase-server";

export interface HealthCheckInput {
  checkName: string;
  status: "pass" | "fail" | "warn";
  latencyMs: number;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordHealthCheck(
  params: HealthCheckInput,
): Promise<void> {
  try {
    const supabase = await createServerClient();

    await supabase.from("health_check_logs").insert({
      check_name: params.checkName,
      status: params.status,
      latency_ms: params.latencyMs,
      message: params.message ?? null,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Health check logging must never break the health endpoint.
  }
}
