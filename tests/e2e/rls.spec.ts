import { test, expect } from "@playwright/test";

test.describe("RLS", () => {
  test("API returns 200 for authenticated user", async ({ request }) => {
    // .env.test configures MOCK_AUTH_EMAIL, so the user is authenticated
    const response = await request.get("/api/privacy/settings");
    expect(response.status()).toBe(200);
  });
});
