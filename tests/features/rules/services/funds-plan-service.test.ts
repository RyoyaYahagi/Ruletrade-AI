import { describe, expect, it } from "vitest";
import { calculateInvestableFunds } from "@/features/rules/services/funds-plan-service";
import { FundsPlanSchema } from "@/schemas/rules/funds-plan-schema";

function buildPlan(input: Record<string, unknown>) {
  const parsed = FundsPlanSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid plan fixture");
  return parsed.data;
}

describe("calculateInvestableFunds", () => {
  it("subtracts emergency fund, upcoming expenses, and repayment", () => {
    const result = calculateInvestableFunds(
      buildPlan({
        cashSavings: 5_000_000,
        monthlyLivingCost: 200_000,
        emergencyFundMonths: 6,
        upcomingExpenses: 1_000_000,
        plannedDebtRepayment: 500_000,
      }),
    );

    expect(result.emergencyFund).toBe(1_200_000);
    expect(result.investableAmount).toBe(2_300_000);
    expect(result.isShortfall).toBe(false);
  });

  it("flags a shortfall when reserves exceed savings", () => {
    const result = calculateInvestableFunds(
      buildPlan({
        cashSavings: 1_000_000,
        monthlyLivingCost: 250_000,
        emergencyFundMonths: 6,
      }),
    );

    expect(result.emergencyFund).toBe(1_500_000);
    expect(result.investableAmount).toBe(-500_000);
    expect(result.isShortfall).toBe(true);
  });

  it("uses the schema default of six emergency-fund months", () => {
    const plan = buildPlan({
      cashSavings: 3_000_000,
      monthlyLivingCost: 100_000,
    });

    expect(plan.emergencyFundMonths).toBe(6);
    expect(calculateInvestableFunds(plan).investableAmount).toBe(2_400_000);
  });

  it("treats an all-zero plan as zero investable funds", () => {
    const result = calculateInvestableFunds(buildPlan({}));

    expect(result.emergencyFund).toBe(0);
    expect(result.investableAmount).toBe(0);
    expect(result.isShortfall).toBe(false);
  });
});
