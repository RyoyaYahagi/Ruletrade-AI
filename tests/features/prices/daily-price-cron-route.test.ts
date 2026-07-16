import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/errors/to-error-response", () => ({
  toErrorResponse: vi.fn(async (error: AppError) =>
    Response.json({ ok: false }, { status: error.status }),
  ),
}));

import { GET } from "@/app/api/cron/prices/daily/route";

describe("daily price cron route", () => {
  it("rejects a request without the cron secret", async () => {
    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";

    try {
      const response = await GET(
        new Request("http://localhost/api/cron/prices/daily"),
      );
      expect(response.status).toBe(401);
    } finally {
      if (previousSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previousSecret;
    }
  });
});
