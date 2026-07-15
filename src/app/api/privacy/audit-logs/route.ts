import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDatabaseClient } from "@/lib/db/database-client";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const db = await createDatabaseClient();
    const { data, error } = await db
      .from("privacy_audit_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return apiSuccess({ auditLogs: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/audit-logs",
      method: "GET",
    });
  }
}
