import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDatabaseClient } from "@/lib/db/database-client";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const db = await createDatabaseClient();
    const { data, error } = await db
      .from("legal_notices")
      .select("*")
      .eq("locale", "ja")
      .is("deprecated_at", null)
      .order("effective_at", { ascending: false });
    if (error) throw error;
    return apiSuccess({ notices: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/legal/notices",
      method: "GET",
    });
  }
}
