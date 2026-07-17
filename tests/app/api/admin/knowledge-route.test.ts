import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin }));
vi.mock("@/features/knowledge/services/knowledge-article-service", () => ({
  listKnowledgeArticles: vi.fn(),
  createKnowledgeArticle: vi.fn(),
}));
vi.mock("@/lib/errors/to-error-response", () => ({
  toErrorResponse: vi.fn(async (error: AppError) => Response.json({ ok: false }, { status: error.status })),
}));

import { GET } from "@/app/api/admin/knowledge/route";

describe("admin knowledge API", () => {
  it("一般ユーザー相当の認証失敗を403として返す", async () => {
    requireAdmin.mockRejectedValueOnce(new AppError("FORBIDDEN", "管理者権限が必要です。", 403));
    const response = await GET();
    expect(response.status).toBe(403);
  });
});
