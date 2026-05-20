import { describe, expect, test } from "vitest";
import { generateRequestId } from "@/lib/observability/request-id";

describe("generateRequestId", () => {
  test("returns a valid UUID", () => {
    const id = generateRequestId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  test("returns unique values", () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).not.toBe(b);
  });
});
