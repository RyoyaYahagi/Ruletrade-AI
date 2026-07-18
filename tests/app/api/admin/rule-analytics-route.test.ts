import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminRuleAnalytics: vi.fn(),
  toErrorResponse: vi.fn(),
}));

vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/features/rules/services/rule-analytics-service", () => ({
  getAdminRuleAnalytics: mocks.getAdminRuleAnalytics,
}));
vi.mock("@/lib/errors/to-error-response", () => ({ toErrorResponse: mocks.toErrorResponse }));

import { GET } from "@/app/api/admin/rule-analytics/route";

describe("GET /api/admin/rule-analytics", () => {
  it("does not expose analytics to a non-admin user", async () => {
    const error = new AppError("FORBIDDEN", "forbidden", 403);
    const response = new Response(JSON.stringify({ ok: false }), { status: 403 });
    mocks.requireAdmin.mockRejectedValueOnce(error);
    mocks.toErrorResponse.mockReturnValueOnce(response);

    const result = await GET(new Request("http://localhost/api/admin/rule-analytics"));

    expect(result).toBe(response);
    expect(mocks.getAdminRuleAnalytics).not.toHaveBeenCalled();
  });
});
