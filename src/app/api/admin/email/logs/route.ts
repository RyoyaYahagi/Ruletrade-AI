import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { createDatabaseClient } from "@/lib/db/database-client";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.email.read");
    const db = await createDatabaseClient();
    const { data, error } = await db
      .from("email_send_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return apiSuccess({ logs: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/email/logs",
      method: "GET",
    });
  }
}
