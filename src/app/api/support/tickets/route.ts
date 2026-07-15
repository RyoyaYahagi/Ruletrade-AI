import { requireUser } from "@/lib/auth/require-user";
import { createDatabaseClient } from "@/lib/db/database-client";
import { apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { CreateSupportTicketSchema } from "@/schemas/support/support-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, CreateSupportTicketSchema);
    const db = await createDatabaseClient();

    const { data, error } = await db
      .from("support_tickets")
      .insert({
        user_id: user.id,
        email: input.email,
        subject: input.subject,
        body: input.body,
        category: input.category,
        request_id: input.requestId ?? null,
        current_path: input.currentPath ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return apiCreated({ ticket: data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/support/tickets",
      method: "POST",
    });
  }
}
