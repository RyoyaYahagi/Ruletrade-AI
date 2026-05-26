import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("authenticated user can access dashboard", async ({ page }) => {
    // .env.test configures MOCK_AUTH_EMAIL, so the user is always authenticated
    await page.goto("/dashboard");
    // Should stay on dashboard (not redirect to login)
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
