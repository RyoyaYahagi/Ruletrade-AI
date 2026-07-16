import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  updateAiUsageSettings: vi.fn(),
  toErrorResponse: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/ai/services/ai-usage-service", () => ({
  updateAiUsageSettings: mocks.updateAiUsageSettings,
}));
vi.mock("@/lib/errors/to-error-response", () => ({
  toErrorResponse: mocks.toErrorResponse,
}));

import { PUT } from "@/app/api/ai-usage/settings/route";

describe("PUT /api/ai-usage/settings", () => {
  it("returns a validation error outside the supported range", async () => {
    const response = new Response(JSON.stringify({ ok: false }), {
      status: 400,
    });
    mocks.requireUser.mockResolvedValueOnce({ id: "user-1" });
    mocks.toErrorResponse.mockReturnValueOnce(response);

    const result = await PUT(
      new Request("http://localhost/api/ai-usage/settings", {
        method: "PUT",
        body: JSON.stringify({ monthlyLimitUsd: 10.01 }),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(result).toBe(response);
    expect(mocks.updateAiUsageSettings).not.toHaveBeenCalled();
    expect(mocks.toErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
      expect.objectContaining({
        route: "/api/ai-usage/settings",
        method: "PUT",
      }),
    );
  });
});
