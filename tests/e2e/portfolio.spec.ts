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

  test("各銘柄にルール閲覧リンクまたは作成ボタンを表示する", async ({
    page,
  }) => {
    await page.route("**/api/portfolio/positions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            positions: [
              {
                id: "position-with-rule",
                ticker: "RULED",
                company_name: "ルールあり銘柄",
                market: "JP",
                currency: "JPY",
                asset_type: "stock",
                sector: "金融",
                market_value: 200_000,
                rule_session_id: "session-existing",
              },
              {
                id: "position-without-rule",
                ticker: "NEW",
                company_name: "未設定銘柄",
                market: "JP",
                currency: "JPY",
                asset_type: "stock",
                sector: "テクノロジー",
                market_value: 100_000,
                rule_session_id: null,
              },
            ],
          },
        }),
      });
    });

    await page.goto("/portfolio");

    const ruledRow = page.locator("tbody tr").filter({ hasText: "RULED" });
    const newRow = page.locator("tbody tr").filter({ hasText: "NEW" });

    const ruleLink = ruledRow.getByTestId("portfolio-position-rule-link");
    await expect(ruleLink).toHaveAttribute("href", "/rules/session-existing");
    await expect(ruleLink).toHaveText("ルールを見る");
    await expect(
      newRow.getByTestId("portfolio-position-create-rule-button"),
    ).toBeVisible();
    await expect(
      newRow.getByTestId("portfolio-position-rule-link"),
    ).toHaveCount(0);
  });

  test("ルールを作成するとルール画面へ遷移する", async ({ page }) => {
    await page.route("**/api/portfolio/positions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            positions: [
              {
                id: "position-without-rule",
                ticker: "NEW",
                company_name: "未設定銘柄",
                market: "JP",
                currency: "JPY",
                asset_type: "stock",
                sector: "テクノロジー",
                market_value: 100_000,
                rule_session_id: null,
              },
            ],
          },
        }),
      });
    });
    await page.route(
      "**/api/portfolio/positions/position-without-rule/create-rule-session",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: { sessionId: "session-xyz" },
          }),
        });
      },
    );

    await page.goto("/portfolio");
    await page.getByTestId("portfolio-position-create-rule-button").click();

    await expect(page).toHaveURL(/\/rules\/session-xyz$/);
  });

  test("作成APIのエラーを表示し、ポートフォリオに留まる", async ({ page }) => {
    await page.route("**/api/portfolio/positions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            positions: [
              {
                id: "position-without-rule",
                ticker: "NEW",
                company_name: "未設定銘柄",
                market: "JP",
                currency: "JPY",
                asset_type: "stock",
                sector: "テクノロジー",
                market_value: 100_000,
                rule_session_id: null,
              },
            ],
          },
        }),
      });
    });
    await page.route(
      "**/api/portfolio/positions/position-without-rule/create-rule-session",
      async (route) => {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: {
              code: "CONFLICT",
              message: "この保有銘柄には既にルールが設定されています。",
            },
          }),
        });
      },
    );

    await page.goto("/portfolio");
    await page.getByTestId("portfolio-position-create-rule-button").click();

    await expect(
      page.getByTestId("portfolio-position-create-rule-error"),
    ).toContainText("この保有銘柄には既にルールが設定されています。");
    await expect(page).toHaveURL(/\/portfolio$/);
  });
});
