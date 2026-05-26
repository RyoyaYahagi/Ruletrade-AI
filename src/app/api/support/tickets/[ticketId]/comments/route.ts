import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerClient } from "@/lib/db/supabase-server";
import { apiSuccess, apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { CreateSupportCommentSchema } from "@/schemas/support/support-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { ticketId } = await params;
    const supabase = await createServerClient();

    // Verify ticket ownership before returning comments
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("user_id")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError) throw ticketError;
    if (!ticket) {
      return apiSuccess({ comments: [] });
    }

    if (ticket.user_id !== user.id) {
      // Only admins can view other users' tickets
      await requireAdmin();
    }

    const { data, error } = await supabase
      .from("support_ticket_comments")
      .select("*")
      .eq("ticket_id", ticketId)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return apiSuccess({ comments: data ?? [] });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/support/tickets/:ticketId/comments",
      method: "GET",
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { ticketId } = await params;
    const input = await validateJsonRequest(
      request,
      CreateSupportCommentSchema,
    );
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("support_ticket_comments")
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        body: input.body,
      })
      .select()
      .single();
    if (error) throw error;
    return apiCreated({ comment: data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/support/tickets/:ticketId/comments",
      method: "POST",
    });
  }
}
