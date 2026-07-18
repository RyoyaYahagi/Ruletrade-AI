import { expect, test } from "@playwright/test";

test.describe("Rules system overview", () => {
  test("/dashboard redirects to /rules", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/rules$/);
    await expect(page.getByTestId("rules-page")).toBeVisible();
  });

  test("displays the rules system page", async ({ page }) => {
    await page.goto("/rules");

    await expect(page.getByTestId("rules-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "ルール体系" }),
    ).toBeVisible();
    await expect(
      page.getByText("売買の推奨ではありません。", { exact: false }),
    ).toBeVisible();
  });

  test("navigates to the new rule form", async ({ page }) => {
    await page.goto("/rules");
    await page.getByTestId("rules-new-rule-button").click();

    await expect(page).toHaveURL(/\/rules\/new$/);
    await expect(page.getByTestId("new-rule-form")).toBeVisible();
  });

  test("navigates to the portfolio", async ({ page }) => {
    await page.goto("/rules");
    await page.getByTestId("rules-portfolio-link").click();

    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(page.getByTestId("portfolio-page")).toBeVisible();
  });

  test("shows the empty coverage matrix copy when there are no sessions", async ({
    page,
  }) => {
    await page.goto("/rules");

    await expect(page.getByTestId("rules-coverage-matrix")).toBeVisible();
    const emptyState = page.getByTestId("rules-coverage-empty-state");
    if (await emptyState.count()) {
      await expect(emptyState).toContainText("まだ銘柄ルールがありません");
    } else {
      await expect(page.getByText("ルールのカバレッジ")).toBeVisible();
    }
  });
});
