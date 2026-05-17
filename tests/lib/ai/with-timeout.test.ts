import { describe, expect, it } from "vitest";
import { withTimeout } from "@/lib/ai/with-timeout";
import { AIProviderError } from "@/lib/ai/ai-provider-error";

describe("withTimeout", () => {
  it("タイムアウト時に AI_PROVIDER_TIMEOUT エラーを投げる", async () => {
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(withTimeout(slowPromise, 10)).rejects.toThrow(AIProviderError);
    await expect(withTimeout(slowPromise, 10)).rejects.toThrow(
      "AI provider request timed out.",
    );
  });

  it("タイムアウト時に AbortController を abort する", async () => {
    const controller = new AbortController();
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      await withTimeout(slowPromise, 10, controller);
    } catch {
      // expected
    }

    expect(controller.signal.aborted).toBe(true);
  });

  it("promise が先に解決した場合はその値を返す", async () => {
    const fastPromise = Promise.resolve("success");
    const result = await withTimeout(fastPromise, 1000);
    expect(result).toBe("success");
  });
});
