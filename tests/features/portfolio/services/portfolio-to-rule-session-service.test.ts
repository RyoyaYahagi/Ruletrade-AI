import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRuleSessionFromPortfolioPosition } from "@/features/portfolio/services/portfolio-to-rule-session-service";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

vi.mock("@/features/rules/services/rule-session-service", () => ({
  createRuleSession: vi.fn(),
}));

import { createDatabaseClient } from "@/lib/db/database-client";
import { createRuleSession } from "@/features/rules/services/rule-session-service";

const mockSingle = vi.fn();
const mockEqSelectB = vi.fn(() => ({ single: mockSingle }));
const mockEqSelectA = vi.fn(() => ({ eq: mockEqSelectB }));
const mockSelect = vi.fn(() => ({ eq: mockEqSelectA }));

const mockEqUpdateC = vi
  .fn()
  .mockResolvedValue({ data: [], error: null });
const mockEqUpdateB = vi.fn(() => ({ eq: mockEqUpdateC }));
const mockUpdate = vi.fn(() => ({ eq: mockEqUpdateB }));

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

const mockDatabase = { from: mockFrom };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createDatabaseClient).mockResolvedValue(
    mockDatabase as unknown as never,
  );
});

const basePosition = {
  id: "position-1",
  user_id: "user-1",
  ticker: "AAPL",
  company_name: "Apple Inc.",
  market: "US",
  currency: "USD",
  memo: "事業の成長性を確認する。",
  position_status: "active",
  rule_session_id: null,
};

describe("createRuleSessionFromPortfolioPosition", () => {
  it("正常系: ルールセッションを作成し、memoとポジションを更新する", async () => {
    mockSingle.mockResolvedValueOnce({ data: basePosition, error: null });
    vi.mocked(createRuleSession).mockResolvedValueOnce({
      sessionId: "session-1",
    });

    const result = await createRuleSessionFromPortfolioPosition({
      userId: "user-1",
      positionId: "position-1",
    });

    expect(result).toEqual({ sessionId: "session-1" });
    expect(createRuleSession).toHaveBeenCalledWith({
      userId: "user-1",
      ticker: "AAPL",
      companyName: "Apple Inc.",
      market: "US",
      currency: "USD",
      templateKey: "portfolio-position",
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, "portfolio_positions");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEqSelectA).toHaveBeenCalledWith("id", "position-1");
    expect(mockEqSelectB).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockSingle).toHaveBeenCalled();

    expect(mockFrom).toHaveBeenNthCalledWith(2, "rule_design_sessions");
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      rule_json: { freeNotes: "事業の成長性を確認する。" },
    });
    expect(mockEqUpdateB).toHaveBeenNthCalledWith(1, "id", "session-1");
    expect(mockEqUpdateC).toHaveBeenNthCalledWith(1, "user_id", "user-1");

    expect(mockFrom).toHaveBeenNthCalledWith(3, "portfolio_positions");
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      rule_session_id: "session-1",
    });
    expect(mockEqUpdateB).toHaveBeenNthCalledWith(2, "id", "position-1");
    expect(mockEqUpdateC).toHaveBeenNthCalledWith(2, "user_id", "user-1");
  });

  it("memoがnullまたは空白の場合、rule_jsonを更新しない", async () => {
    for (const memo of [null, "   "]) {
      mockSingle.mockResolvedValueOnce({
        data: { ...basePosition, memo },
        error: null,
      });
      vi.mocked(createRuleSession).mockResolvedValueOnce({
        sessionId: "session-1",
      });

      await createRuleSessionFromPortfolioPosition({
        userId: "user-1",
        positionId: "position-1",
      });
    }

    expect(mockFrom).toHaveBeenLastCalledWith("portfolio_positions");
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenLastCalledWith({
      rule_session_id: "session-1",
    });
  });

  it("他ユーザーのpositionはNOT_FOUNDとして拒否する", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      createRuleSessionFromPortfolioPosition({
        userId: "other-user",
        positionId: "position-1",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("DBエラーの場合も404として扱う", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error("DB connection lost"),
    });

    await expect(
      createRuleSessionFromPortfolioPosition({
        userId: "user-1",
        positionId: "position-1",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("既にrule_session_idがある場合は409で拒否し、作成しない", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...basePosition, rule_session_id: "existing-session" },
      error: null,
    });

    await expect(
      createRuleSessionFromPortfolioPosition({
        userId: "user-1",
        positionId: "position-1",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
    expect(createRuleSession).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("archivedポジションは400で拒否し、作成しない", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...basePosition, position_status: "archived" },
      error: null,
    });

    await expect(
      createRuleSessionFromPortfolioPosition({
        userId: "user-1",
        positionId: "position-1",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(createRuleSession).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("nullフィールドをcreateRuleSessionの引数へ変換する", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        ...basePosition,
        company_name: null,
        market: null,
        currency: null,
        memo: null,
      },
      error: null,
    });
    vi.mocked(createRuleSession).mockResolvedValueOnce({
      sessionId: "session-1",
    });

    await createRuleSessionFromPortfolioPosition({
      userId: "user-1",
      positionId: "position-1",
    });

    expect(createRuleSession).toHaveBeenCalledWith({
      userId: "user-1",
      ticker: "AAPL",
      companyName: undefined,
      market: undefined,
      currency: "JPY",
      templateKey: "portfolio-position",
    });
  });
});
