import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("authenticated user can access the rules system", async ({ page }) => {
    // E2E_TEST_AUTH configures deterministic server-side auth.
    await page.goto("/rules");
    // Should stay on the rules system (not redirect to login)
    await expect(page).toHaveURL(/.*rules/);
  });
});
