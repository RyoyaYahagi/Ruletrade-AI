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

  test("複合ポートフォリオで価格鮮度、円換算、状態バッジを同時に表示する", async ({
    page,
  }) => {
    await page.route("**/api/portfolio/positions", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            positions: [
              {
                id: "position-jp",
                ticker: "7203",
                company_name: "A社",
                market: "JP",
                currency: "JPY",
                asset_type: "stock",
                sector: "自動車",
                current_price: 3000,
                market_value: 300000,
                rule_session_id: "session-jp",
                priceSource: "auto",
                priceAsOf: "2026-07-16",
                isStale: false,
              },
              {
                id: "position-us",
                ticker: "AAPL",
                company_name: "Apple",
                market: "US",
                currency: "USD",
                asset_type: "stock",
                sector: "Technology",
                current_price: 150,
                market_value: 150,
                rule_session_id: null,
                priceSource: "auto",
                priceAsOf: "2026-07-10",
                isStale: true,
              },
            ],
          },
        }),
      });
    });
    await page.route("**/api/attention-statuses", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { statuses: { "session-jp": "on_track", "position-us": "needs_check" } },
        }),
      });
    });

    await page.goto("/portfolio");
    await expect(page.getByText("7203")).toBeVisible();
    await expect(page.getByText("2026-07-16時点")).toBeVisible();
    await expect(page.getByTestId("attention-badge-on_track")).toBeVisible();
    await expect(page.getByTestId("attention-badge-needs_check")).toBeVisible();
    await expect(page.getByText("⚠ 4日以上未更新")).toBeVisible();

    await page.getByTestId("portfolio-jpy-toggle").check();
    await expect(page.getByText("22,500 円")).toBeVisible();
    await expect(page.getByTestId("portfolio-jpy-rate-input")).toHaveValue("150");
  });
});
