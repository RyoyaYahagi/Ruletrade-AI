import { describe, expect, it } from "vitest";

import { sortTodayFeedItems } from "@/features/ux/services/today-feed-service";

describe("sortTodayFeedItems", () => {
  it("condition_met を needs_check より先にし、各グループを新しい順にする", () => {
    const sorted = sortTodayFeedItems([
      {
        kind: "review_due",
        status: "needs_check",
        title: "期限",
        href: "/rules/1",
        createdAt: "2026-07-16T12:00:00.000Z",
      },
      {
        kind: "alert",
        status: "condition_met",
        title: "成立",
        href: "/rules/2",
        createdAt: "2026-07-15T12:00:00.000Z",
      },
      {
        kind: "news",
        status: "condition_met",
        title: "ニュース",
        href: "/notifications",
        createdAt: "2026-07-16T13:00:00.000Z",
      },
    ]);

    expect(sorted.map((item) => item.kind)).toEqual([
      "news",
      "alert",
      "review_due",
    ]);
  });
});
