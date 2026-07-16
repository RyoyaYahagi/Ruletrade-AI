import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminAiUsage: vi.fn(),
  toErrorResponse: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/features/ai/services/ai-usage-service", () => ({
  getAdminAiUsage: mocks.getAdminAiUsage,
}));
vi.mock("@/lib/errors/to-error-response", () => ({
  toErrorResponse: mocks.toErrorResponse,
}));

import { GET } from "@/app/api/admin/ai-usage/route";

describe("GET /api/admin/ai-usage", () => {
  it("returns the forbidden response for a non-admin user", async () => {
    const error = new AppError("FORBIDDEN", "管理者権限が必要です。", 403);
    const response = new Response(JSON.stringify({ ok: false }), {
      status: 403,
    });
    mocks.requireAdmin.mockRejectedValueOnce(error);
    mocks.toErrorResponse.mockReturnValueOnce(response);

    const result = await GET();

    expect(result).toBe(response);
    expect(mocks.getAdminAiUsage).not.toHaveBeenCalled();
    expect(mocks.toErrorResponse).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ route: "/api/admin/ai-usage", method: "GET" }),
    );
  });
});
