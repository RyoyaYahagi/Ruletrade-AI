import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  FundsPlanSchema,
  type FundsPlan,
} from "@/schemas/rules/funds-plan-schema";

export type FundsPlanCalculation = {
  emergencyFund: number;
  investableAmount: number;
  isShortfall: boolean;
};

export function calculateInvestableFunds(plan: FundsPlan): FundsPlanCalculation {
  const emergencyFund = plan.monthlyLivingCost * plan.emergencyFundMonths;
  const investableAmount =
    plan.cashSavings -
    emergencyFund -
    plan.upcomingExpenses -
    plan.plannedDebtRepayment;

  return {
    emergencyFund,
    investableAmount,
    isShortfall: investableAmount < 0,
  };
}

export async function getFundsPlan(params: {
  userId: string;
}): Promise<{ plan: FundsPlan | null; calculation: FundsPlanCalculation | null }> {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("funds_plans")
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "資金計画の取得に失敗しました。",
      500,
      error,
    );
  }

  if (!data?.plan_json) {
    return { plan: null, calculation: null };
  }

  const parsed = FundsPlanSchema.safeParse(data.plan_json);
  if (!parsed.success) {
    return { plan: null, calculation: null };
  }

  return { plan: parsed.data, calculation: calculateInvestableFunds(parsed.data) };
}

export async function upsertFundsPlan(params: {
  userId: string;
  plan: FundsPlan;
}): Promise<{ plan: FundsPlan; calculation: FundsPlanCalculation }> {
  const db = await createDatabaseClient();

  const { data: existing, error: findError } = await db
    .from("funds_plans")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (findError) {
    throw new AppError(
      "INTERNAL_ERROR",
      "資金計画の確認に失敗しました。",
      500,
      findError,
    );
  }

  if (existing) {
    const { error: updateError } = await db
      .from("funds_plans")
      .update({ plan_json: params.plan })
      .eq("id", existing.id)
      .eq("user_id", params.userId);

    if (updateError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "資金計画の更新に失敗しました。",
        500,
        updateError,
      );
    }
  } else {
    const { error: insertError } = await db.from("funds_plans").insert({
      user_id: params.userId,
      plan_json: params.plan,
    });

    if (insertError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "資金計画の保存に失敗しました。",
        500,
        insertError,
      );
    }
  }

  return { plan: params.plan, calculation: calculateInvestableFunds(params.plan) };
}
