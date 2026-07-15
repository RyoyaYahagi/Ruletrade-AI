import { test, expect } from "@playwright/test";

test.describe("Portfolio", () => {
  test.beforeEach(async ({ page }) => {
    // .env.test configures mock auth, so user is authenticated
    await page.goto("/portfolio");
  });

  test("displays portfolio page with title", async ({ page }) => {
    await expect(page.getByTestId("portfolio-page")).toBeVisible();
    await expect(page.getByTestId("portfolio-title")).toBeVisible();
    await expect(page.getByTestId("portfolio-title")).toContainText("Portfolio");
  });

  test("has add position link", async ({ page }) => {
    await expect(page.getByTestId("portfolio-add-position-link")).toBeVisible();
    await expect(page.getByTestId("portfolio-add-position-link")).toContainText("保有銘柄を追加");
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
