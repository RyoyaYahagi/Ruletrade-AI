import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  assertAiDeveloperSettingsEnabled: vi.fn(),
  getAiDeveloperDashboard: vi.fn(),
  createAiExperimentNote: vi.fn(),
  toErrorResponse: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/ai/services/ai-developer-settings-service", () => ({
  assertAiDeveloperSettingsEnabled: mocks.assertAiDeveloperSettingsEnabled,
}));
vi.mock("@/features/ai/services/ai-observability-service", () => ({
  getAiDeveloperDashboard: mocks.getAiDeveloperDashboard,
  createAiExperimentNote: mocks.createAiExperimentNote,
}));
vi.mock("@/lib/errors/to-error-response", () => ({
  toErrorResponse: mocks.toErrorResponse,
}));

import { GET, POST } from "@/app/api/ai/developer-dashboard/route";

describe("/api/ai/developer-dashboard", () => {
  it("does not access the dashboard for an unauthenticated user", async () => {
    const error = new AppError("UNAUTHORIZED", "ログインが必要です。", 401);
    const response = new Response(JSON.stringify({ ok: false }), {
      status: 401,
    });
    mocks.requireUser.mockRejectedValueOnce(error);
    mocks.toErrorResponse.mockReturnValueOnce(response);

    const result = await GET();

    expect(result).toBe(response);
    expect(mocks.getAiDeveloperDashboard).not.toHaveBeenCalled();
    expect(mocks.toErrorResponse).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        route: "/api/ai/developer-dashboard",
        method: "GET",
      }),
    );
  });

  it("passes the authenticated user id to dashboard reads and note writes", async () => {
    mocks.requireUser.mockResolvedValue({ id: "user-a" });
    mocks.getAiDeveloperDashboard.mockResolvedValue({
      runs: [],
      experiments: [],
    });
    mocks.createAiExperimentNote.mockResolvedValue({ id: "experiment-1" });

    await GET();
    await POST(
      new Request("http://localhost/api/ai/developer-dashboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Latency check",
          hypothesis: "Shorter context reduces latency",
          changeSummary: "Reduced retrieved chunks",
        }),
      }),
    );

    expect(mocks.getAiDeveloperDashboard).toHaveBeenCalledWith("user-a");
    expect(mocks.createAiExperimentNote).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({
        title: "Latency check",
        status: "in_progress",
        tags: [],
      }),
    );
  });
});
