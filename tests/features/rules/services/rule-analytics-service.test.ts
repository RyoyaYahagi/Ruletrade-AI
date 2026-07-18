import { describe, expect, it } from "vitest";
import { aggregateRuleAnalytics } from "@/features/rules/services/rule-analytics-service";

describe("aggregateRuleAnalytics", () => {
  it("calculates answer, completion and abandonment metrics by question", () => {
    const result = aggregateRuleAnalytics(
      [
        event("s1", "session_created", "2026-07-01T00:00:00.000Z"),
        event("s1", "question_viewed", "2026-07-01T00:01:00.000Z", "q1", "holding_purpose"),
        event("s1", "question_started", "2026-07-01T00:01:05.000Z", "q1", "holding_purpose"),
        event("s1", "answer_saved", "2026-07-01T00:02:00.000Z", "q1", "holding_purpose"),
        event("s2", "session_created", "2026-07-01T00:00:00.000Z"),
        event("s2", "question_viewed", "2026-07-01T00:03:00.000Z", "q1", "holding_purpose"),
      ],
      "2026-07-01T01:00:00.000Z",
    );

    expect(result.sessions.started).toBe(2);
    expect(result.sessions.abandoned).toBe(1);
    expect(result.questions[0]).toMatchObject({
      questionKey: "holding_purpose",
      viewed: 2,
      answered: 1,
      abandoned: 1,
      answerRate: 0.5,
    });
    expect(result.questions[0].medianAnswerTimeMs).toBe(60000);
  });

  it("separates AI draft acceptance from edits", () => {
    const result = aggregateRuleAnalytics(
      [
        event("s1", "session_created", "2026-07-01T00:00:00.000Z"),
        event("s1", "question_viewed", "2026-07-01T00:01:00.000Z", "q1", "thesis_draft"),
        event("s1", "answer_saved", "2026-07-01T00:02:00.000Z", "q1", "thesis_draft", { draftUsage: "accepted" }),
        event("s2", "session_created", "2026-07-01T00:00:00.000Z"),
        event("s2", "thesis_draft_requested", "2026-07-01T00:01:00.000Z"),
        event("s2", "thesis_draft_succeeded", "2026-07-01T00:01:05.000Z"),
        event("s2", "question_viewed", "2026-07-01T00:01:05.000Z", "q2", "thesis_draft"),
        event("s2", "answer_saved", "2026-07-01T00:03:00.000Z", "q2", "thesis_draft", { draftUsage: "edited" }),
      ],
      "2026-07-01T01:00:00.000Z",
    );

    expect(result.aiDrafts).toMatchObject({
      requested: 1,
      succeeded: 1,
      accepted: 1,
      edited: 1,
      acceptanceRate: 0.5,
      editedRate: 0.5,
    });
  });
});

function event(
  sessionId: string,
  eventName: string,
  occurredAt: string,
  questionId?: string,
  questionKey?: string,
  metadata?: Record<string, unknown>,
) {
  return {
    session_id: sessionId,
    event_name: eventName,
    occurred_at: occurredAt,
    question_id: questionId,
    question_key: questionKey,
    metadata_json: metadata ?? {},
  };
}
