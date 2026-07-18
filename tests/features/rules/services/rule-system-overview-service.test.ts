import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDatabaseClient } from "@/lib/db/database-client";
import type { AttentionStatusRecords } from "@/features/ux/services/attention-status-service";
import type { InvestmentMemory } from "@/features/trading/services/investment-memory-service";
import {
  buildRuleSystemOverview,
  computeRuleCoverage,
  getRuleSystemOverview,
} from "@/features/rules/services/rule-system-overview-service";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));
vi.mock("@/features/trading/services/investment-memory-service", () => ({
  getInvestmentMemory: vi.fn(),
}));

import { getInvestmentMemory } from "@/features/trading/services/investment-memory-service";

const emptyRecords = (): AttentionStatusRecords => ({
  sessions: [],
  questions: [],
  qualityChecks: [],
  alerts: [],
  notifications: [],
  positions: [],
});

const baseRule = {
  investmentThesis: "事業の成長を観測する",
  entryPlan: {
    targetPriceMin: 100,
    targetPriceMax: 120,
    tranches: 2,
    entryConditions: ["移動平均線を上回る"],
  },
  exitPlan: {
    targetPrice: 150,
    targetMultiple: 1.5,
    takeProfitRule: "目標到達時に確認する",
    exitConditions: ["前提が崩れる"],
  },
  exitTriggers: [
    { category: "fundamental", condition: "業績悪化", action: "review" },
  ],
  riskManagement: {
    maxPositionPercent: 10,
    maxPositionAmount: 100000,
    maxLossPercent: 8,
    stopLossRule: "前提が崩れたら見直す",
    riskNotes: ["集中を避ける"],
  },
  thesisBreakers: [{ description: "競争力が下がる" }],
};

describe("computeRuleCoverage", () => {
  it("全項目入りのTradeRuleは全カテゴリを定義済みにする", () => {
    const result = computeRuleCoverage(baseRule);

    expect(result).toEqual({
      coverage: { entry: true, exit: true, risk: true, thesis: true },
      ruleParseFailed: false,
    });
  });

  it("空のルールは正常パースし、全カテゴリを未定義にする", () => {
    const result = computeRuleCoverage({});

    expect(result).toEqual({
      coverage: { entry: false, exit: false, risk: false, thesis: false },
      ruleParseFailed: false,
    });
  });

  it("単一カテゴリの条件をそれぞれ判定する", () => {
    expect(
      computeRuleCoverage({ exitTriggers: baseRule.exitTriggers }).coverage,
    ).toEqual({
      entry: false,
      exit: true,
      risk: false,
      thesis: false,
    });
    expect(
      computeRuleCoverage({ riskManagement: { riskNotes: ["集中を避ける"] } })
        .coverage,
    ).toEqual({ entry: false, exit: false, risk: true, thesis: false });
    expect(
      computeRuleCoverage({ investmentThesis: "   " }).coverage.thesis,
    ).toBe(false);
    expect(
      computeRuleCoverage({ thesisBreakers: baseRule.thesisBreakers }).coverage
        .thesis,
    ).toBe(true);
  });

  it("壊れたJSON文字列とスキーマ違反をパース失敗として扱う", () => {
    expect(computeRuleCoverage("{broken")).toEqual({
      coverage: { entry: false, exit: false, risk: false, thesis: false },
      ruleParseFailed: true,
    });
    expect(
      computeRuleCoverage({ entryPlan: { targetPriceMin: "invalid" } })
        .ruleParseFailed,
    ).toBe(true);
  });
});

describe("buildRuleSystemOverview", () => {
  const now = new Date("2026-07-18T00:00:00.000Z");

  it("archivedを除外し、レビュー期限・未紐付け・統計を導出する", () => {
    const records = emptyRecords();
    records.sessions = [
      {
        id: "session-new",
        ticker: "7203",
        company_name: "A社",
        status: "finalized",
        quality_gate_status: "passed",
        last_reviewed_at: "2026-04-18T00:00:00.000Z",
        updated_at: "2026-07-17T00:00:00.000Z",
        rule_json: {},
      },
      {
        id: "session-recent",
        ticker: "6758",
        status: "in_progress",
        last_reviewed_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-07-16T00:00:00.000Z",
        rule_json: { exitTriggers: baseRule.exitTriggers },
      },
      {
        id: "session-archived",
        ticker: "9999",
        status: "archived",
        updated_at: "2026-07-15T00:00:00.000Z",
        rule_json: baseRule,
      },
    ];
    records.positions = [
      {
        id: "position-unlinked",
        ticker: "1111",
        company_name: "未紐付け",
        position_status: "active",
        rule_session_id: null,
      },
      {
        id: "position-linked",
        ticker: "2222",
        position_status: "active",
        rule_session_id: "session-new",
      },
      {
        id: "position-archived",
        ticker: "3333",
        position_status: "archived",
        rule_session_id: null,
      },
    ];

    const result = buildRuleSystemOverview(records, null, now);

    expect(result.sessions.map((session) => session.id)).toEqual([
      "session-new",
      "session-recent",
    ]);
    expect(result.sessions[0]).toMatchObject({
      gaps: ["entry", "exit", "risk", "thesis"],
      reviewDue: true,
      ruleParseFailed: false,
    });
    expect(result.sessions[1]).toMatchObject({
      gaps: ["entry", "risk", "thesis"],
      reviewDue: false,
    });
    expect(result.unlinkedPositions).toEqual([
      { id: "position-unlinked", ticker: "1111", companyName: "未紐付け" },
    ]);
    expect(result.stats).toEqual({
      sessionsTotal: 2,
      approvedCount: 1,
      gapsTotal: 7,
      reviewDueCount: 1,
      unlinkedCount: 1,
    });
  });

  it("memoryがnullでも動作し、不正なstanding_constraintsを許容する", () => {
    const memory: InvestmentMemory = {
      id: "memory-1",
      user_id: "user-1",
      risk_tolerance: "moderate",
      preferred_markets: ["日本株"],
      time_horizons: [],
      rejected_patterns: [],
      standing_constraints: { invalid: true },
      notes: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    expect(
      buildRuleSystemOverview(emptyRecords(), null, now).policy,
    ).toBeNull();
    expect(buildRuleSystemOverview(emptyRecords(), memory, now).policy).toEqual(
      {
        riskTolerance: "moderate",
        preferredMarkets: ["日本株"],
        standingConstraints: [],
      },
    );
  });
});

describe("getRuleSystemOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("全クエリに要求ユーザーの所有フィルタを付け、別ユーザーを混入させない", async () => {
    const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
      rule_design_sessions: [
        {
          id: "session-owned",
          user_id: "user-1",
          ticker: "7203",
          status: "in_progress",
          rule_json: {},
          updated_at: "2026-07-18T00:00:00.000Z",
        },
        {
          id: "session-other-user",
          user_id: "user-2",
          ticker: "6758",
          status: "finalized",
          rule_json: {},
          updated_at: "2026-07-18T00:00:00.000Z",
        },
      ],
      rule_questions: [],
      rule_quality_checks: [],
      rule_alert_events: [],
      notifications: [],
      portfolio_positions: [
        {
          id: "position-owned",
          user_id: "user-1",
          ticker: "7203",
          position_status: "active",
          rule_session_id: "session-owned",
        },
        {
          id: "position-other-user",
          user_id: "user-2",
          ticker: "6758",
          position_status: "active",
          rule_session_id: null,
        },
      ],
    };
    const queryCalls: Array<[string, string, string]> = [];
    const mockFrom = vi.fn((table: string) => {
      const query = { select: vi.fn(), eq: vi.fn() };
      query.select.mockReturnValue(query);
      query.eq.mockImplementation((column: string, value: string) => {
        queryCalls.push([table, column, value]);
        return Promise.resolve({
          data: (rowsByTable[table] ?? []).filter(
            (row) => row[column] === value,
          ),
          error: null,
        });
      });
      return query;
    });

    vi.mocked(createDatabaseClient).mockResolvedValue({
      from: mockFrom,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(getInvestmentMemory).mockResolvedValue({ data: null });

    const result = await getRuleSystemOverview({ userId: "user-1" });

    expect(queryCalls).toHaveLength(6);
    expect(queryCalls).toEqual(
      expect.arrayContaining([
        ["rule_design_sessions", "user_id", "user-1"],
        ["rule_questions", "user_id", "user-1"],
        ["rule_quality_checks", "user_id", "user-1"],
        ["rule_alert_events", "user_id", "user-1"],
        ["notifications", "user_id", "user-1"],
        ["portfolio_positions", "user_id", "user-1"],
      ]),
    );
    expect(result.sessions.map((session) => session.id)).toEqual([
      "session-owned",
    ]);
    expect(result.unlinkedPositions).toEqual([]);
    expect(getInvestmentMemory).toHaveBeenCalledWith("user-1");
  });
});
