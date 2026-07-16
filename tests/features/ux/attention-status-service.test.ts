import { describe, expect, it } from "vitest";

import {
  buildAttentionStatusMap,
  evaluateAttentionStatus,
  type AttentionStatusRecords,
} from "@/features/ux/services/attention-status-service";

describe("evaluateAttentionStatus", () => {
  const session = {
    id: "session-1",
    status: "finalized",
    quality_gate_status: "passed",
    last_reviewed_at: "2026-07-10T00:00:00.000Z",
  };

  it("未解決アラートを condition_met と判定する", () => {
    expect(
      evaluateAttentionStatus({
        session,
        pendingQuestions: [],
        qualityChecks: [],
        alerts: [{ session_id: "session-1", status: "open" }],
        notifications: [],
      }),
    ).toBe("condition_met");
  });

  it("警告だけなら needs_check、何もなければ on_track と判定する", () => {
    expect(
      evaluateAttentionStatus({
        session,
        pendingQuestions: [],
        qualityChecks: [{ status: "warning" }],
        alerts: [],
        notifications: [],
      }),
    ).toBe("needs_check");
    expect(
      evaluateAttentionStatus({
        session,
        pendingQuestions: [],
        qualityChecks: [],
        alerts: [],
        notifications: [],
      }),
    ).toBe("on_track");
  });

  it("アラートと警告が両方ある場合は condition_met を優先する", () => {
    expect(
      evaluateAttentionStatus({
        session,
        pendingQuestions: [{ status: "pending" }],
        qualityChecks: [{ severity: "high" }],
        alerts: [{ resolution: null }],
        notifications: [],
      }),
    ).toBe("condition_met");
  });
});

describe("buildAttentionStatusMap", () => {
  it("一括取得済みデータから銘柄・セッションの状態を構築する", () => {
    const records: AttentionStatusRecords = {
      sessions: [
        {
          id: "session-1",
          ticker: "AAA",
          status: "finalized",
          quality_gate_status: "passed",
          last_reviewed_at: "2026-07-15T00:00:00.000Z",
        },
      ],
      questions: [],
      qualityChecks: [],
      alerts: [],
      notifications: [],
      positions: [
        { id: "position-1", ticker: "AAA", rule_session_id: "session-1" },
        { id: "position-2", ticker: "BBB", rule_session_id: null },
      ],
    };

    const statuses = buildAttentionStatusMap(
      records,
      new Date("2026-07-16T00:00:00.000Z"),
    );

    expect(statuses.get("session-1")).toBe("on_track");
    expect(statuses.get("position-1")).toBe("on_track");
    expect(statuses.get("BBB")).toBe("needs_check");
  });
});
