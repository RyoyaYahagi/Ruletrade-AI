import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

export async function incrementUsage(params: {
  userId: string;
  eventType:
    | "ai_review"
    | "document_upload"
    | "rag_indexing"
    | "embedding_request";
  amount?: number;
}) {
  const db = await createDatabaseClient();
  const amount = params.amount ?? 1;

  const now = new Date();
  const periodStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const periodEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).toISOString();

  const { data: existing } = await db
    .from("usage_counters")
    .select("*")
    .eq("user_id", params.userId)
    .eq("counter_type", params.eventType)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (existing) {
    await db
      .from("usage_counters")
      .update({ used_count: existing.used_count + amount })
      .eq("id", existing.id);
  } else {
    await db.from("usage_counters").insert({
      user_id: params.userId,
      counter_type: params.eventType,
      period_start: periodStart,
      period_end: periodEnd,
      used_count: amount,
      limit_count: 0,
    });
  }

  await db.from("usage_events").insert({
    user_id: params.userId,
    event_type: params.eventType,
    amount,
  });
}

export async function checkUsageLimit(params: {
  userId: string;
  eventType:
    | "ai_review"
    | "document_upload"
    | "rag_indexing"
    | "embedding_request";
}) {
  const db = await createDatabaseClient();

  const now = new Date();
  const periodStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const { data: counter } = await db
    .from("usage_counters")
    .select("*")
    .eq("user_id", params.userId)
    .eq("counter_type", params.eventType)
    .eq("period_start", periodStart)
    .maybeSingle();

  const { data: planData } = await db
    .from("billing_customers")
    .select("billing_subscriptions(billing_plans(*))")
    .eq("user_id", params.userId)
    .maybeSingle();

  const rawPlan = planData?.billing_subscriptions?.[0]?.billing_plans;
  const plan = rawPlan as unknown as Record<string, unknown> | null;
  const limitMap: Record<string, string> = {
    ai_review: "monthly_ai_reviews",
    document_upload: "monthly_document_uploads",
    rag_indexing: "monthly_rag_indexings",
    embedding_request: "monthly_embedding_requests",
  };
  const limit = (plan?.[limitMap[params.eventType]] as number) ?? 0;
  const used = counter?.used_count ?? 0;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exceeded: used >= limit,
  };
}
