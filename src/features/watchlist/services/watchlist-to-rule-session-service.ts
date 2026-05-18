import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { createRuleSession } from "@/features/rules/services/rule-session-service";

export async function createRuleSessionFromWatchlistItem(params: {
  userId: string;
  itemId: string;
}) {
  const supabase = await createServerClient();

  const { data: item, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("id", params.itemId)
    .eq("user_id", params.userId)
    .single();

  if (error || !item) {
    throw new AppError(
      "NOT_FOUND",
      "Watchlist itemが見つかりません。",
      404,
    );
  }

  const result = await createRuleSession({
    userId: params.userId,
    ticker: item.ticker,
    companyName: item.company_name ?? undefined,
    market: item.market ?? undefined,
    currency: item.currency ?? "JPY",
    templateKey: "watchlist-item",
  });

  await supabase
    .from("rule_design_sessions")
    .update({
      rule_json: {
        investmentThesis: item.interest_reason ?? undefined,
        entryPlan: {
          targetPriceMin: item.target_price_min ?? undefined,
          targetPriceMax: item.target_price_max ?? undefined,
          tranches: item.planned_tranches ?? undefined,
          currency: item.currency ?? "JPY",
        },
        riskManagement: {
          maxPositionPercent: item.max_position_percent ?? undefined,
          stopLossRule: item.stop_loss_note ?? undefined,
        },
        exitPlan: {
          targetMultiple: item.target_multiple ?? undefined,
          takeProfitRule: item.take_profit_note ?? undefined,
        },
        earningsPolicy: {
          policy: "undecided",
          notes: item.earnings_note ?? undefined,
        },
        freeNotes: item.research_notes ?? undefined,
      },
    })
    .eq("id", result.sessionId)
    .eq("user_id", params.userId);

  await supabase
    .from("watchlist_items")
    .update({
      status: "rule_designing",
      rule_session_id: result.sessionId,
    })
    .eq("id", params.itemId)
    .eq("user_id", params.userId);

  return { sessionId: result.sessionId };
}
