import { describe, expect, test } from "vitest";
import { withTimeout, TimeoutError } from "@/lib/performance/with-timeout";

describe("withTimeout", () => {
  test("returns result when promise resolves before timeout", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000);
    expect(result).toBe(42);
  });

  test("throws TimeoutError when promise exceeds timeout", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));

    await expect(withTimeout(slowPromise, 10)).rejects.toThrow(TimeoutError);
  });

  test("throws original error when promise rejects before timeout", async () => {
    const error = new Error("original");

    await expect(withTimeout(Promise.reject(error), 1000)).rejects.toThrow(
      "original",
    );
  });
});
