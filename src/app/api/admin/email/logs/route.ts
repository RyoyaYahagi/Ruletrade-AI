import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { createServerClient } from "@/lib/db/supabase-server";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.email.read");
    const supabase = await createServerClient();
    const { data, error } = await supabase
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
