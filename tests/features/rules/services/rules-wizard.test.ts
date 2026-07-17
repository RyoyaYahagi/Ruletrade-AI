import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DatabaseClient = import("@/lib/db/database-client").DatabaseClient;

describe("beginner rule question wizard", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  let tempDir: string;
  let db: DatabaseClient;
  let createInitialQuestions: typeof import("@/features/rules/services/rule-question-service").createInitialQuestions;
  let applyAnswerToRuleJson: typeof import("@/features/rules/services/rule-draft-service").applyAnswerToRuleJson;
  let saveRuleAnswer: typeof import("@/features/rules/services/rule-answer-service").saveRuleAnswer;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-wizard-"));
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    vi.resetModules();
    const databaseModule = await import("@/lib/db/database-client");
    const questionModule = await import("@/features/rules/services/rule-question-service");
    const draftModule = await import("@/features/rules/services/rule-draft-service");
    const answerModule = await import("@/features/rules/services/rule-answer-service");
    db = await databaseModule.createDatabaseClient();
    createInitialQuestions = questionModule.createInitialQuestions;
    applyAnswerToRuleJson = draftModule.applyAnswerToRuleJson;
    saveRuleAnswer = answerModule.saveRuleAnswer;
  });

  afterEach(() => {
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("creates all ten catalog questions in display order", async () => {
    await createSession();
    await createInitialQuestions({ userId: "user-a", sessionId: "session-a" });

    const result = await db
      .from("rule_questions")
      .select("question_key, display_order, allow_unknown, unknown_default_json")
      .eq("session_id", "session-a")
      .order("display_order", { ascending: true });

    expect(result.data).toHaveLength(10);
    expect(result.data?.map((question) => question.question_key)).toEqual([
      "holding_purpose",
      "time_horizon",
      "thesis_seed",
      "thesis_draft",
      "thesis_breakers_pick",
      "stop_loss_review",
      "take_profit_review",
      "max_position",
      "earnings_policy",
      "review_cycle",
    ]);
    expect(
      result.data?.find((question) => question.question_key === "thesis_draft"),
    ).toMatchObject({ allow_unknown: 0, unknown_default_json: null });
  });

  it("maps a nested monitoring answer into rule_json", async () => {
    await createSession();
    const ruleJson = await applyAnswerToRuleJson({
      userId: "user-a",
      sessionId: "session-a",
      questionKey: "stop_loss_review",
      answerJson: { value: 15 },
    });

    expect(ruleJson).toMatchObject({
      monitoring: { stopLossReviewPercent: 15 },
    });
  });

  it("stores unknown answers and applies their default value", async () => {
    await createSession();
    await createInitialQuestions({ userId: "user-a", sessionId: "session-a" });
    const question = await db
      .from("rule_questions")
      .select("id")
      .eq("session_id", "session-a")
      .eq("question_key", "stop_loss_review")
      .single();

    await saveRuleAnswer({
      userId: "user-a",
      sessionId: "session-a",
      questionId: question.data?.id,
      questionKey: "stop_loss_review",
      answerText: "15%で見直す",
      answerJson: { unknown: true, appliedDefault: true, value: 15 },
    });

    const answers = await db
      .from("rule_answers")
      .select("answer_json")
      .eq("session_id", "session-a");
    expect(answers.data?.[0]?.answer_json).toMatchObject({
      unknown: true,
      appliedDefault: true,
      value: 15,
    });

    const session = await db
      .from("rule_design_sessions")
      .select("rule_json")
      .eq("id", "session-a")
      .single();
    expect(session.data?.rule_json).toMatchObject({
      monitoring: { stopLossReviewPercent: 15 },
    });
  });

  async function createSession() {
    await db.from("rule_design_sessions").insert({
      id: "session-a",
      user_id: "user-a",
      ticker: "7203",
      status: "in_progress",
      rule_json: {},
    });
  }
});
