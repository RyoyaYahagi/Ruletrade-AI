import { expect, test } from "@playwright/test";
import path from "node:path";
import Database from "better-sqlite3";

for (const width of [1280, 320]) {
  test(`CSV preview, import, duplicate and undo at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/more");
    const before = await (await page.request.get("/api/export")).json();
    await page
      .getByLabel("CSVを選択")
      .setInputFiles(
        path.join(process.cwd(), "tests/fixtures/csv-import/rakuten-us.csv"),
      );
    await expect(
      page.getByRole("button", { name: /件をインポート/ }),
    ).toBeEnabled();
    await expect(page.getByText(/USD/).first()).toBeVisible();
    const during = await (await page.request.get("/api/export")).json();
    expect(during.transactions).toEqual(before.transactions);
    const importButton = page.getByRole("button", { name: /件をインポート/ });
    await importButton.click();
    await expect(page.getByRole("status")).toHaveText(/件をインポートしました/);
    const after = await (await page.request.get("/api/export")).json();
    expect(after.transactions.length).toBeGreaterThan(
      before.transactions.length,
    );
    await page
      .getByLabel("CSVを選択")
      .setInputFiles(
        path.join(process.cwd(), "tests/fixtures/csv-import/rakuten-us.csv"),
      );
    await expect(
      page.getByRole("button", { name: "0件をインポート" }),
    ).toBeDisabled();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/csv-import-${width}.png`,
      fullPage: true,
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "取り消す", exact: true })
      .first()
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "インポートを取り消しました。",
    );
    const undone = await (await page.request.get("/api/export")).json();
    expect(undone.transactions).toEqual(before.transactions);
  });
}

test("investment fund CSV gives a clear explanation", async ({ page }) => {
  await page.goto("/more");
  await page
    .getByLabel("CSVを選択")
    .setInputFiles(
      path.join(
        process.cwd(),
        "tests/fixtures/csv-import/rakuten-investment-fund.csv",
      ),
    );
  await expect(
    page.getByRole("region", { name: "取引履歴を読み込む" }).getByRole("alert"),
  ).toContainText("投資信託");
  await expect(
    page.getByRole("button", { name: /件をインポート/ }),
  ).toHaveCount(0);
});

test("reviews a manual trade conflict, applies either value, and can undo safely", async ({
  page,
}) => {
  let savedStockId: string | undefined;
  try {
    const ticker = "MERGE-E2E-9027";
    const stockName = "取込確認用の架空会社";
    const extraction = {
      type: "buy",
      stock: { ticker, name: stockName, market: "JP" },
      summary: "CSV照合の確認用記録",
      points: [{ kind: "other", text: "CSV照合の確認用記録", source: "raw_input" }],
      transaction: {
        side: "buy",
        quantity: 10,
        price: 1000,
        fee: null,
        executedAt: "2025-01-10T12:00:00.000Z",
      },
      followUpQuestion: null,
    };
    await page.route("**/api/decisions/extract", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        json: extraction,
      });
    });
    await page.goto("/capture");
    await page
      .getByLabel("いま考えていること")
      .fill("CSV照合テスト用の判断メモ。");
    await page.getByRole("button", { name: "内容を整理する" }).click();
    await expect(
      page.getByRole("heading", { name: "整理した内容を確認してください" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "この内容で保存" }).click();
    await expect(page).toHaveURL(/\/stocks\//);
    const stockId = new URL(page.url()).pathname.split("/").at(-1)!;
    savedStockId = stockId;

    const csv = [
      "約定日,受渡日,銘柄コード,銘柄名,市場名称,口座区分,取引区分,売買区分,信用区分,数量［株］,単価［円］,手数料［円］,受渡金額［円］",
      `2025/01/10,2025/01/14,${ticker},${stockName},東証,特定,現物,買付,現物,10,1500,55,15055`,
    ].join("\n");
    const chooseCsv = async () => {
      await page.goto("/more");
      await page.getByLabel("CSVを選択").setInputFiles({
        name: "manual-merge-review.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      });
      await expect(
        page.getByText("1件", { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "同じ取引として統合" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "1件を反映" }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "同じ取引として統合" }).click();
    };
    const stockTransaction = async () => {
      const exported = await (await page.request.get("/api/export")).json();
      return exported.transactions.find(
        (transaction: { stockId: string }) => transaction.stockId === stockId,
      );
    };

    await chooseCsv();
    await page.getByLabel("CSV: 1500").check();
    await page.getByRole("button", { name: "1件を反映" }).click();
    await expect(page.getByRole("status")).toContainText(
      "1件を既存の取引に統合しました",
    );
    expect((await stockTransaction()).price).toBe(1500);
    expect((await stockTransaction()).fee).toBe(55);

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "取り消す", exact: true })
      .first()
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "インポートを取り消しました。",
    );
    expect((await stockTransaction()).price).toBe(1000);
    expect((await stockTransaction()).fee).toBeNull();

    await chooseCsv();
    await page.getByLabel("既存: 1000").check();
    await page.getByRole("button", { name: "1件を反映" }).click();
    await expect(page.getByRole("status")).toContainText(
      "1件を既存の取引に統合しました",
    );
    expect((await stockTransaction()).price).toBe(1000);
    expect((await stockTransaction()).fee).toBe(55);
  } finally {
    // This suite shares the server's test database; remove only this test's records.
    const database = new Database(
      path.join(process.cwd(), ".data/e2e-test.sqlite"),
    );
    try {
      database.pragma("foreign_keys = ON");
      database
        .prepare("DELETE FROM import_batches WHERE file_name = ?")
        .run("manual-merge-review.csv");
      if (savedStockId)
        database.prepare("DELETE FROM stocks WHERE id = ?").run(savedStockId);
    } finally {
      database.close();
    }
  }
});

test("imports Monex CP932 history, prevents duplicates and undoes the batch", async ({
  page,
}) => {
  await page.goto("/more");
  const before = await (await page.request.get("/api/export")).json();
  const upload = () =>
    page
      .getByLabel("CSVを選択")
      .setInputFiles(
        path.join(
          process.cwd(),
          "tests/fixtures/csv-import/monex-jp-cp932.csv",
        ),
      );
  await upload();
  await expect(
    page.getByRole("button", { name: "7件をインポート" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "7件をインポート" }).click();
  await expect(page.getByRole("status")).toContainText(
    "7件をインポートしました",
  );
  const after = await (await page.request.get("/api/export")).json();
  const trades = after.transactions.filter(
    (transaction: { sourceBroker: string }) =>
      transaction.sourceBroker === "monex",
  );
  expect(trades).toHaveLength(7);
  expect(
    trades.every(
      (transaction: { fee: number | null }) => transaction.fee === null,
    ),
  ).toBe(true);
  expect(
    trades
      .map(
        (transaction: { settlementAmount: number }) =>
          transaction.settlementAmount,
      )
      .sort(),
  ).toEqual([-1000, -1000, -1000, -1000, 990, 990, 990].sort());
  await upload();
  await expect(
    page.getByRole("button", { name: "0件をインポート" }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "取り消す", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "インポートを取り消しました。",
  );
  const undone = await (await page.request.get("/api/export")).json();
  expect(undone.transactions).toEqual(before.transactions);
});
