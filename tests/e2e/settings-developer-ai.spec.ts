import { test, expect } from "@playwright/test";

test.describe("Developer AI Settings", () => {
  test("can switch provider and model and save", async ({ page }) => {
    await page.goto("/settings/developer");

    await expect(page.getByTestId("developer-ai-settings-form")).toBeVisible();
    await page.getByTestId("developer-ai-provider").selectOption("openai");
    await page.getByTestId("developer-ai-model").selectOption("gpt-4.1");
    await page.getByTestId("developer-ai-save").click();

    await expect(page.getByTestId("developer-ai-message")).toContainText(
      "AI設定を保存しました",
    );
  });

  test("requests ChatGPT login when Codex App Server is selected", async ({
    page,
  }) => {
    await page.route("**/api/ai/codex/account", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            authenticated: false,
            authMode: null,
            planType: null,
          },
        }),
      });
    });
    await page.route("**/api/ai/codex/login", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            mode: "browser",
            loginId: "test-login",
            authUrl: "https://chatgpt.com/auth/test",
          },
        }),
      });
    });

    await page.goto("/settings/developer");
    await page.getByTestId("developer-ai-provider").selectOption("codex-app-server");

    await expect(page.getByTestId("codex-login-panel")).toBeVisible();
    await expect(page.getByRole("link", { name: "ChatGPTログイン画面を開く" })).toBeVisible();
    await expect(page.getByTestId("developer-ai-save")).toBeDisabled();
  });

  test("records an LLM experiment note in the developer dashboard", async ({
    page,
  }) => {
    await page.goto("/settings/developer");

    await expect(page.getByTestId("developer-ai-observability")).toBeVisible();
    await page
      .getByTestId("developer-ai-experiment-title")
      .fill("文脈長を短くする");
    await page
      .getByLabel("仮説")
      .fill("入力文脈を短くすると、品質を保ったまま遅延を減らせる");
    await page
      .getByTestId("developer-ai-experiment-change")
      .fill("取得チャンクを8件から4件へ変更");
    await page
      .getByLabel("結果・観測できたこと")
      .fill("平均レイテンシを比較中");
    await page.getByLabel("詰まった点").fill("評価ケースがまだ少ない");
    await page.getByLabel("次の一手").fill("固定evalを追加する");
    await page.getByTestId("developer-ai-experiment-save").click();

    await expect(
      page.getByTestId("developer-ai-experiment-message"),
    ).toContainText("試行ノートを保存しました");
    await expect(
      page.getByTestId("developer-ai-experiment-note").first(),
    ).toContainText("文脈長を短くする");
  });
});
