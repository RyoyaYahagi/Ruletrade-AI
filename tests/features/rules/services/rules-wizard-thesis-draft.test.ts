import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DatabaseClient = import("@/lib/db/database-client").DatabaseClient;

describe("generateThesisDraft", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  let tempDir: string;
  let db: DatabaseClient;
  let generateThesisDraft: typeof import("@/features/rules/services/thesis-draft-service").generateThesisDraft;
  let callAi: typeof import("@/lib/ai/provider-gateway").callAi;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-thesis-"));
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    vi.resetModules();
    vi.doMock("@/lib/ai/provider-gateway", () => ({ callAi: vi.fn() }));
    const databaseModule = await import("@/lib/db/database-client");
    const serviceModule = await import("@/features/rules/services/thesis-draft-service");
    const aiModule = await import("@/lib/ai/provider-gateway");
    db = await databaseModule.createDatabaseClient();
    generateThesisDraft = serviceModule.generateThesisDraft;
    callAi = aiModule.callAi;
    await db.from("rule_design_sessions").insert({
      id: "session-a",
      user_id: "user-a",
      ticker: "7203",
      company_name: "A社",
      status: "in_progress",
      rule_json: {},
    });
    await db.from("rule_questions").insert({
      user_id: "user-a",
      session_id: "session-a",
      question_key: "thesis_breakers_pick",
      question_text: "見立てが外れた条件は？",
      question_type: "multiple_choice",
      status: "pending",
      display_order: 5,
    });
  });

  afterEach(() => {
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.doUnmock("@/lib/ai/provider-gateway");
    vi.resetModules();
  });

  it("returns an error when the AI output cannot be parsed", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: false,
      error: "invalid structured output",
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "AI_OUTPUT_INVALID", status: 422 });
  });

  it("stores AI breaker candidates on the next question", async () => {
    vi.mocked(callAi).mockResolvedValue({
      ok: true,
      data: {
        thesis: "私は事業の成長を観測する。",
        breakers: [
          { description: "業績が悪化する", newsKeywords: ["減収"] },
          { description: "競争力が低下する", newsKeywords: ["競争"] },
          { description: "統治上の問題が確認される", newsKeywords: ["不祥事"] },
          { description: "保有理由を説明できなくなる", newsKeywords: ["仮説"] },
        ],
      },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: "mock",
      estimatedCostUsd: 0,
    });

    const result = await generateThesisDraft({
      userId: "user-a",
      sessionId: "session-a",
    });

    expect(result.thesisDraft).toBe("私は事業の成長を観測する。");
    const question = await db
      .from("rule_questions")
      .select("options, breaker_source")
      .eq("session_id", "session-a")
      .eq("question_key", "thesis_breakers_pick")
      .single();
    expect(question.data?.breaker_source).toBe("ai");
    expect(question.data?.options).toEqual([
      { label: "業績が悪化する", value: "業績が悪化する" },
      { label: "競争力が低下する", value: "競争力が低下する" },
      { label: "統治上の問題が確認される", value: "統治上の問題が確認される" },
      { label: "保有理由を説明できなくなる", value: "保有理由を説明できなくなる" },
    ]);
  });

  it("rejects a session owned by another user before calling the AI", async () => {
    await expect(
      generateThesisDraft({ userId: "user-b", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(callAi).not.toHaveBeenCalled();
  });

  it("stops before the AI call when the monthly cost limit is exceeded", async () => {
    const { getMonthlyCostPeriod } = await import(
      "@/lib/cost-limit/cost-limit-period"
    );
    const { periodStart, periodEnd } = getMonthlyCostPeriod();
    await db.from("cost_limit_counters").insert({
      user_id: "user-a",
      period_start: periodStart,
      period_end: periodEnd,
      used_cost_usd: 100,
      limit_cost_usd: 100,
    });

    await expect(
      generateThesisDraft({ userId: "user-a", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "COST_LIMIT_EXCEEDED", status: 402 });
    expect(callAi).not.toHaveBeenCalled();
  });
});
