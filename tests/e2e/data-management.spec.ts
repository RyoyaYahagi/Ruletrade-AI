import { expect, test } from "@playwright/test";

for (const width of [1280, 320]) {
  test(`data management navigation and menu work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator('a[href="/api/export"]')).toHaveCount(0);
    const navigation = page.getByRole("navigation", { name: "メインナビゲーション" });
    await expect(navigation.getByRole("link")).toHaveText(["記録", "売買履歴"]);

    const button = page.getByRole("button", { name: "補助メニュー" });
    const dataLink = page.getByRole("link", { name: "データ管理", exact: true });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(dataLink).toBeVisible();
    await button.click();
    await expect(dataLink).toHaveCount(0);
    await button.click();
    await page.getByRole("heading", { name: "最近の判断" }).click();
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(dataLink).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dataLink).toHaveCount(0);
    await expect(button).toBeFocused();

    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await expect(dataLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "お問い合わせ・改善要望" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/data");
    await expect(page.getByRole("heading", { name: "データ管理", exact: true })).toBeVisible();
    await expect(page.getByText("記録したデータの書き出しや読み込みを管理します。")).toBeVisible();
    await expect(page.getByRole("heading", { name: "データを書き出す" })).toBeVisible();
    const exportLink = page.getByRole("link", { name: "JSONをエクスポート" });
    await expect(exportLink).toHaveAttribute("href", "/api/export");
    await expect(exportLink).toHaveAttribute("download", "");
    await expect(button).toHaveAttribute("aria-expanded", "false");

    await button.click();
    await expect(dataLink).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const linkBox = await dataLink.boundingBox();
    expect(linkBox).not.toBeNull();
    expect(linkBox!.x).toBeGreaterThanOrEqual(0);
    expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/data-management-${width}.png`, fullPage: true });
  });
}
