import { expect, test } from "@playwright/test";

test.describe("Today", () => {
  test("確認事項ゼロのときは肯定的な空状態を表示する", async ({ page }) => {
    await page.route("**/api/today", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            items: [],
            stats: { positionsCount: 0, rulesApproved: 0, rulesNeedingCheck: 0 },
          },
        }),
      });
    });

    await page.goto("/today");

    await expect(page.getByTestId("today-page")).toBeVisible();
    await expect(page.getByTestId("today-empty-state")).toContainText(
      "今日は確認することがありません。",
    );
    await expect(page.getByText("ルールを守って何もしない日は、良い日です。"))
      .toBeVisible();
  });

  test("条件成立カードを表示し、ルール詳細への遷移先を持つ", async ({ page }) => {
    await page.route("**/api/today", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            items: [
              {
                kind: "alert",
                status: "condition_met",
                title: "AAA の条件が成立しました",
                href: "/rules/session-1",
                createdAt: "2026-07-16T00:00:00.000Z",
              },
            ],
            stats: { positionsCount: 1, rulesApproved: 1, rulesNeedingCheck: 0 },
          },
        }),
      });
    });

    await page.goto("/today");

    const alertItem = page.getByTestId("today-item-alert");
    await expect(alertItem).toBeVisible();
    await expect(alertItem).toHaveAttribute("href", "/rules/session-1");
    await expect(page.getByTestId("attention-badge-condition_met")).toContainText(
      "条件成立",
    );
  });
});
