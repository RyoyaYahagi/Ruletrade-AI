import { expect, test } from "@playwright/test";

for (const width of [1280, 320]) {
  test(`main navigation reaches data management at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator('a[href="/api/export"]')).toHaveCount(0);
    // 幅に応じて上部ナビか下部ナビのどちらか一方だけが表示される。
    const navigation = page.getByRole("navigation", {
      name: "メインナビゲーション",
    });
    await expect(navigation).toHaveCount(1);
    await expect(navigation.getByRole("link")).toHaveText([
      "今日",
      "銘柄",
      "記録",
      "売買",
      "その他",
    ]);
    await expect(
      navigation.getByRole("link", { name: "今日", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await navigation.getByRole("link", { name: "その他", exact: true }).click();
    await expect(page).toHaveURL("/more");
    await expect(
      page.getByRole("heading", { name: "その他", exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "その他", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("heading", { name: "バックアップ" }),
    ).toBeVisible();
    const exportLink = page.getByRole("link", { name: /JSONをエクスポート/ });
    await expect(exportLink).toHaveAttribute("href", "/api/export");
    await expect(exportLink).toHaveAttribute("download", "");
    await expect(
      page.getByRole("button", { name: /お問い合わせ・改善要望/ }),
    ).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const linkBox = await exportLink.boundingBox();
    expect(linkBox).not.toBeNull();
    expect(linkBox!.x).toBeGreaterThanOrEqual(0);
    expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `test-results/data-management-${width}.png`,
      fullPage: true,
    });
  });
}
