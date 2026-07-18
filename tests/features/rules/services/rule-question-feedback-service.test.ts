import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("rule question feedback service", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  let tempDir: string;
  let db: import("@/lib/db/database-client").DatabaseClient;
  let service: typeof import("@/features/rules/services/rule-question-feedback-service");

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-question-feedback-"));
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    vi.resetModules();
    const databaseModule = await import("@/lib/db/database-client");
    db = await databaseModule.createDatabaseClient();
    service = await import("@/features/rules/services/rule-question-feedback-service");
    await db.from("rule_design_sessions").insert([
      { id: "session-a", user_id: "user-a", ticker: "7203", status: "in_progress" },
      { id: "session-b", user_id: "user-b", ticker: "7203", status: "in_progress" },
    ]);
    await db.from("rule_questions").insert([
      {
        id: "question-a",
        user_id: "user-a",
        session_id: "session-a",
        question_key: "thesis_draft",
        question_text: "仮説は？",
        question_type: "long_text",
      },
      {
        id: "question-b",
        user_id: "user-b",
        session_id: "session-b",
        question_key: "thesis_draft",
        question_text: "仮説は？",
        question_type: "long_text",
      },
    ]);
  });

  afterEach(() => {
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("質問ごとの評価を保存し、同じ質問への再送信で更新する", async () => {
    const first = await service.saveQuestionFeedback({
      userId: "user-a",
      sessionId: "session-a",
      input: {
        questionId: "question-a",
        questionQuality: "good",
        choiceQuality: "needs_improvement",
        draftEffort: "reduced",
        reason: "事業内容を考えるきっかけになった",
        draftRunId: null,
      },
    });
    expect(first.feedback.question_key).toBe("thesis_draft");

    const second = await service.saveQuestionFeedback({
      userId: "user-a",
      sessionId: "session-a",
      input: {
        questionId: "question-a",
        questionQuality: "needs_improvement",
        choiceQuality: null,
        draftEffort: "unchanged",
        reason: "もう少し具体的な問いがよい",
        draftRunId: null,
      },
    });
    expect(second.feedback.id).toBe(first.feedback.id);
    expect(second.feedback.question_quality).toBe("needs_improvement");

    const stored = await service.getQuestionFeedback({
      userId: "user-a",
      sessionId: "session-a",
      questionId: "question-a",
    });
    expect(stored.feedback?.draft_effort).toBe("unchanged");
    expect(stored.feedback?.reason).toBe("もう少し具体的な問いがよい");
  });

  it("別ユーザーの質問は読み書きできない", async () => {
    await expect(
      service.getQuestionFeedback({
        userId: "user-b",
        sessionId: "session-a",
        questionId: "question-a",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(
      service.saveQuestionFeedback({
        userId: "user-b",
        sessionId: "session-a",
        input: {
          questionId: "question-a",
          questionQuality: "good",
          choiceQuality: null,
          draftEffort: null,
          reason: null,
          draftRunId: null,
        },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("入力が空のフィードバックをスキーマで拒否する", async () => {
    const { QuestionFeedbackInputSchema } = await import(
      "@/schemas/rules/question-feedback-schema"
    );
    expect(
      QuestionFeedbackInputSchema.safeParse({ questionId: "question-a" }).success,
    ).toBe(false);
    expect(
      QuestionFeedbackInputSchema.safeParse({
        questionId: "question-a",
        reason: "a".repeat(1001),
      }).success,
    ).toBe(false);
  });
});
