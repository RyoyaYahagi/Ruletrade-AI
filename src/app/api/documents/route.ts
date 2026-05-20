import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createServerClient } from "@/lib/db/supabase-server";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const supabase = await createServerClient();

    const { data, error } = await supabase
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
