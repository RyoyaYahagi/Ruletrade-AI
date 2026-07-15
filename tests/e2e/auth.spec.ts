import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("authenticated user can access dashboard", async ({ page }) => {
    // E2E_TEST_AUTH configures deterministic server-side auth.
    await page.goto("/dashboard");
    // Should stay on dashboard (not redirect to login)
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
