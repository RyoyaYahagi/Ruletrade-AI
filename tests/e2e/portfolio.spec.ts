import { test, expect } from "@playwright/test";

test.describe("Portfolio", () => {
  test.beforeEach(async ({ page }) => {
    // E2E_TEST_AUTH configures deterministic server-side auth.
    await page.goto("/portfolio");
  });

  test("displays portfolio page with title", async ({ page }) => {
    await expect(page.getByTestId("portfolio-page")).toBeVisible();
    await expect(page.getByTestId("portfolio-title")).toBeVisible();
  });

  test("has add position link", async ({ page }) => {
    await expect(page.getByTestId("portfolio-add-position-link")).toBeVisible();
    await expect(page.getByTestId("portfolio-add-position-link")).toContainText(
      "保有銘柄を追加",
    );
    await expect(page.getByTestId("portfolio-import-position-link")).toBeVisible();
    await expect(page.getByTestId("portfolio-import-position-link")).toContainText("画像から一括追加");
  });

  test("displays portfolio content sections", async ({ page }) => {
    await expect(page.getByTestId("portfolio-content")).toBeVisible();
  });

  test("displays funds plan card and common rules panel", async ({ page }) => {
    await expect(page.getByTestId("funds-plan-card")).toBeVisible();
    await expect(
      page.getByTestId("portfolio-common-rules-panel"),
    ).toBeVisible();
    await expect(page.getByTestId("save-common-rules")).toBeVisible();
    await expect(page.getByTestId("start-portfolio-rule-guide")).toBeVisible();
  });
});
