import { describe, expect, it } from "vitest";

import {
  CLIENT_REQUEST_ID_PATTERN,
  hashRequestBody,
  isClientRequestId,
  prepareRequestBodyForHash,
} from "@/features/integration/idempotency";

describe("clientRequestId", () => {
  it("accepts RFC 4122 UUIDs case-insensitively and rejects other values", () => {
    expect(
      CLIENT_REQUEST_ID_PATTERN.test("E5F6A7B8-C9D0-4E1F-8A2B-3C4D5E6F7081"),
    ).toBe(true);
    expect(isClientRequestId("e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081")).toBe(
      true,
    );
    for (const value of [
      "",
      "not-a-uuid",
      "e5f6a7b8c9d04e1f8a2b3c4d5e6f7081",
      "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f708",
      "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f708g",
    ]) {
      expect(isClientRequestId(value)).toBe(false);
    }
  });
});

describe("hashRequestBody", () => {
  it("ignores key order and fills undefined with null", () => {
    expect(
      hashRequestBody({ rawInput: "同じ", stockId: null, stockHint: null }),
    ).toBe(
      hashRequestBody({ stockHint: null, rawInput: "同じ", stockId: null }),
    );
    expect(hashRequestBody({ stockHint: undefined })).toBe(
      hashRequestBody({ stockHint: null }),
    );
  });

  it("treats array order and raw input whitespace as different values", () => {
    expect(hashRequestBody({ items: ["a", "b"] })).not.toBe(
      hashRequestBody({ items: ["b", "a"] }),
    );
    expect(hashRequestBody({ rawInput: "原文" })).not.toBe(
      hashRequestBody({ rawInput: " 原文 " }),
    );
  });
});

describe("prepareRequestBodyForHash", () => {
  it("removes only clientRequestId and fills omitted defaults", () => {
    expect(
      prepareRequestBodyForHash(
        {
          clientRequestId: "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7081",
          rawInput: "  原文  ",
        },
        { points: [], summary: null },
      ),
    ).toEqual({ rawInput: "  原文  ", points: [], summary: null });
  });

  it("does not trim, sort, or replace supplied values", () => {
    const reviewDates = [
      "2026-12-07T12:00:00.000Z",
      "2026-11-07T12:00:00.000Z",
      "2026-12-07T12:00:00.000Z",
    ];
    expect(
      prepareRequestBodyForHash(
        { reflection: "  本人の言葉  ", reviewDates },
        { reflection: null, reviewDates: [] },
      ),
    ).toEqual({ reflection: "  本人の言葉  ", reviewDates });
  });
});
