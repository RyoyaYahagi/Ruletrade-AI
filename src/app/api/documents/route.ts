import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDatabaseClient } from "@/lib/db/database-client";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const db = await createDatabaseClient();

    const { data, error } = await db
      .from("user_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return apiSuccess({ documents: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/documents",
      method: "GET",
    });
  }
}
