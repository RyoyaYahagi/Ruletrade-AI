import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { WatchlistItemSchema } from "@/schemas/watchlist/watchlist-item-schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { itemId } = await params;
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("watchlist_items")
      .select("*")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      throw new AppError("NOT_FOUND", "Watchlist itemが見つかりません。", 404);
    }

    return apiSuccess({ item: data });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { itemId } = await params;
    const input = await validateJsonRequest(request, WatchlistItemSchema.partial());
    const supabase = await createServerClient();

    const updateData: Record<string, unknown> = {};
    if (input.ticker !== undefined) updateData.ticker = input.ticker;
    if (input.companyName !== undefined) updateData.company_name = input.companyName;
    if (input.market !== undefined) updateData.market = input.market;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.interestReason !== undefined) updateData.interest_reason = input.interestReason;
    if (input.targetPriceMin !== undefined) updateData.target_price_min = input.targetPriceMin;
    if (input.targetPriceMax !== undefined) updateData.target_price_max = input.targetPriceMax;
    if (input.plannedTranches !== undefined) updateData.planned_tranches = input.plannedTranches;
    if (input.targetMultiple !== undefined) updateData.target_multiple = input.targetMultiple;
    if (input.maxPositionPercent !== undefined) updateData.max_position_percent = input.maxPositionPercent;
    if (input.stopLossNote !== undefined) updateData.stop_loss_note = input.stopLossNote;
    if (input.takeProfitNote !== undefined) updateData.take_profit_note = input.takeProfitNote;
    if (input.earningsNote !== undefined) updateData.earnings_note = input.earningsNote;
    if (input.researchNotes !== undefined) updateData.research_notes = input.researchNotes;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.ruleSessionId !== undefined) updateData.rule_session_id = input.ruleSessionId;

    const { data, error } = await supabase
      .from("watchlist_items")
      .update(updateData)
      .eq("id", itemId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Watchlist itemの更新に失敗しました。",
        500,
        error,
      );
    }

    return apiSuccess({ item: data });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { itemId } = await params;
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("id", itemId)
      .eq("user_id", user.id);

    if (error) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Watchlist itemの削除に失敗しました。",
        500,
        error,
      );
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
