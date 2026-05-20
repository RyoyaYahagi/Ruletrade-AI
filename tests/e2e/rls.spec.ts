import { test, expect } from "@playwright/test";

test.describe("RLS", () => {
  test("API returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/rules/sessions");
    expect(response.status()).toBe(401);
  });
});
