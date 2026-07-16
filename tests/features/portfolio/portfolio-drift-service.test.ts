import { describe, expect, it } from "vitest";
import {
  calculateDrift,
  type DriftFindings,
} from "@/features/portfolio/services/portfolio-drift-service";
import type { PortfolioTarget } from "@/features/portfolio/services/portfolio-target-service";
import { buildDriftAlertMessage } from "@/features/portfolio/services/drift-alert-messages";

function target(
  overrides: Partial<PortfolioTarget> & Pick<PortfolioTarget, "target_type">,
): PortfolioTarget {
  return {
    id: crypto.randomUUID(),
    user_id: "user-a",
    portfolio_id: "portfolio-a",
    target_type: overrides.target_type,
    target_key: null,
    target_percent: 30,
    tolerance_percent: 5,
    created_at: "2026-07-16T00:00:00.000Z",
    updated_at: "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateDrift", () => {
  it("treats the tolerance boundary as not exceeded", () => {
    const result = calculateDrift({
      cashJpy: 25,
      positions: [{ symbol: "7203", valuationJpy: 75 }],
      targets: [target({ target_type: "cash_percent" })],
    });

    expect(result[0]).toMatchObject({ currentPercent: 25, driftPercent: -5, exceeded: false });
  });

  it("flags a cash target six points below a five point tolerance", () => {
    const result = calculateDrift({
      cashJpy: 24,
      positions: [{ symbol: "7203", valuationJpy: 76 }],
      targets: [target({ target_type: "cash_percent" })],
    });

    expect(result[0]).toMatchObject({ currentPercent: 24, driftPercent: -6, exceeded: true });
  });

  it("only flags a position max when the position is above the limit", () => {
    const result = calculateDrift({
      cashJpy: 34,
      positions: [
        { symbol: "7203", valuationJpy: 20 },
        { symbol: "6758", valuationJpy: 46 },
      ],
      targets: [target({ target_type: "position_max_percent", target_key: "*", target_percent: 40 })],
    });

    expect(result.map((finding) => finding.exceeded)).toEqual([false, true]);
  });

  it("exposes stale data on the result and adds the estimate note", () => {
    const result = calculateDrift({
      cashJpy: 50,
      positions: [{ symbol: "7203", valuationJpy: 50, stale: true }],
      targets: [target({ target_type: "position_max_percent", target_key: "*", target_percent: 40 })],
    });

    expect((result as DriftFindings).hasStaleData).toBe(true);
    expect(
      buildDriftAlertMessage({ finding: result[0], hasStaleData: result.hasStaleData }),
    ).toContain("概算です");
  });
});
