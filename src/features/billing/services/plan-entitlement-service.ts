import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function getUserPlan(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: customer } = await supabase
    .from("billing_customers")
    .select("*, billing_subscriptions(*, billing_plans(*))")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (!customer) {
    const { data: defaultPlan } = await supabase
      .from("billing_plans")
      .select("*")
      .eq("slug", "free")
      .single();
    return { plan: defaultPlan, subscription: null };
  }

  const activeSub = customer.billing_subscriptions?.find(
    (s: Record<string, unknown>) =>
      s.status === "active" || s.status === "trialing",
  );

  if (activeSub?.billing_plans) {
    return { plan: activeSub.billing_plans, subscription: activeSub };
  }

  const { data: defaultPlan } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("slug", "free")
    .single();

  return { plan: defaultPlan, subscription: null };
}

export async function assertEntitlement(params: {
  userId: string;
  feature:
    | "ai_review"
    | "document_upload"
    | "rag_indexing"
    | "embedding_request"
    | "portfolio"
    | "watchlist_item"
    | "document";
}) {
  const { plan } = await getUserPlan({ userId: params.userId });

  if (!plan) {
    throw new AppError("FEATURE_DISABLED", "プランが見つかりません。", 403);
  }

  const limits: Record<string, number> = {
    ai_review: plan.monthly_ai_reviews,
    document_upload: plan.monthly_document_uploads,
    rag_indexing: plan.monthly_rag_indexings,
    embedding_request: plan.monthly_embedding_requests,
    portfolio: plan.max_portfolios,
    watchlist_item: plan.max_watchlist_items,
    document: plan.max_documents,
  };

  const limit = limits[params.feature] ?? 0;
  if (limit <= 0) {
    throw new AppError(
      "FEATURE_DISABLED",
      "この機能は現在のプランでは利用できません。",
      403,
    );
  }
}
