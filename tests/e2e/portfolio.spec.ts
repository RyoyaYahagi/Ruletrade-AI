import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";

test("builds the portfolio from trades and links holdings from the home page", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const positions = [
    {
      symbol: "JP1",
      name: `保有検証JP1-${suffix}`,
      currency: "JPY",
      price: 1200.9,
      quantity: 2.5,
    },
    {
      symbol: "US1",
      name: `保有検証US1-${suffix}`,
      currency: "USD",
      price: 24.1299,
      quantity: 0.5,
    },
    {
      symbol: "US2",
      name: `保有検証US2-${suffix}`,
      currency: "USD",
      price: 37,
      quantity: 10,
    },
    {
      symbol: "JP2",
      name: `保有検証JP2-${suffix}`,
      currency: "JPY",
      price: 560,
      quantity: 10,
    },
    {
      symbol: "US3",
      name: `保有検証US3-${suffix}`,
      currency: "USD",
      price: 83,
      quantity: 10,
    },
    {
      symbol: "JP3",
      name: `保有検証JP3-${suffix}`,
      currency: "JPY",
      price: 910,
      quantity: 10,
    },
  ];
  const stockIds = positions.map(
    ({ symbol }) => `portfolio-${suffix}-${symbol}`,
  );
  const database = new Database(
    path.join(process.cwd(), ".data/e2e-test.sqlite"),
  );
  try {
    // Visit first so the app initializes the shared test database and schema.
    await page.goto("/");
    database.pragma("foreign_keys = ON");
    const createdAt = "2099-01-01T00:00:00.000Z";
    const insertStock = database.prepare(
      `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertTransaction = database.prepare(
      `INSERT INTO transactions (id, stock_id, side, quantity, price, fee, executed_at, decision_id, created_at, price_currency)
       VALUES (?, ?, 'buy', ?, ?, NULL, ?, NULL, ?, ?)`,
    );
    const insertDecision = database.prepare(
      `INSERT INTO decisions (id, stock_id, type, raw_input, transcript, follow_up_answer, thesis, assumptions_json, review_conditions_json, add_conditions_json, review_at, created_at, decided_at)
       VALUES (?, ?, 'buy', ?, NULL, NULL, ?, '[]', '[]', '[]', NULL, ?, ?)`,
    );
    positions.forEach((position, index) => {
      const stockId = stockIds[index];
      insertStock.run(
        stockId,
        position.symbol,
        position.name,
        position.name.toLowerCase(),
        position.currency === "JPY" ? "JP" : "US",
        position.currency === "JPY" ? "TSE" : "NASDAQ",
        createdAt,
      );
      insertTransaction.run(
        `portfolio-transaction-${suffix}-${position.symbol}`,
        stockId,
        position.quantity,
        position.price,
        "2000-01-01T00:00:00.000Z",
        createdAt,
        position.currency,
      );
    });
    insertDecision.run(
      `portfolio-decision-${suffix}`,
      stockIds[0],
      `保有検証の最新判断-${suffix}`,
      `保有検証の最新判断-${suffix}`,
      createdAt,
      "2099-01-01",
    );

    await page.goto("/portfolio");
    await expect(
      page.getByRole("heading", { name: "ポートフォリオ", exact: true }),
    ).toBeVisible();
    for (const position of positions) {
      const row = page
        .locator("li, tr, article, a")
        .filter({
          hasText: position.name,
        })
        .first();
      await expect(row).toBeVisible();
      await expect(row.locator("dd").nth(0)).toHaveText(
        position.quantity < 1
          ? "1株未満"
          : `${Math.trunc(position.quantity)}株`,
      );
      await expect(row).toContainText(position.currency);
    }
    const yenRow = page
      .locator("li")
      .filter({ has: page.getByRole("link", { name: positions[0].name }) });
    await expect(yenRow.locator("dd").nth(1)).toHaveText("1,200円");
    await expect(yenRow.locator("dd").nth(2)).toHaveText("3,002円");
    const dollarRow = page
      .locator("li")
      .filter({ has: page.getByRole("link", { name: positions[1].name }) });
    await expect(dollarRow.locator("dd").nth(1)).toHaveText("24.12 USD");
    await expect(dollarRow.locator("dd").nth(2)).toHaveText("12.06 USD");
    await page.getByRole("link", { name: positions[0].name }).click();
    await expect(page).toHaveURL(new RegExp(`/stocks/${stockIds[0]}$`));

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/portfolio");
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);

    await page.goto("/");
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const holdings = page.locator(
      'section[aria-labelledby="holdings-heading"]',
    );
    await expect(
      holdings.getByRole("heading", { name: "現在の保有" }),
    ).toBeVisible();
    const holdingLinks = holdings.locator(`a[href^="/stocks/"]`);
    await expect(holdingLinks).toHaveCount(5);
    await expect(
      holdings.getByRole("link", { name: new RegExp(positions[1].name) }),
    ).toContainText("1株未満");
    await expect(
      holdings.getByRole("link", { name: "ポートフォリオを見る" }),
    ).toBeVisible();
    const recent = page.locator('section[aria-labelledby="recent-heading"]');
    await expect(
      recent.getByRole("heading", { name: "最近の判断" }),
    ).toBeVisible();
    await expect(
      recent.getByText(`保有検証の最新判断-${suffix}`),
    ).toBeVisible();
    const sectionOrder = await page
      .locator("main section")
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("aria-labelledby")),
      );
    expect(sectionOrder.indexOf("holdings-heading")).toBeGreaterThanOrEqual(0);
    expect(sectionOrder.indexOf("recent-heading")).toBe(
      sectionOrder.indexOf("holdings-heading") + 1,
    );
  } finally {
    database.pragma("foreign_keys = ON");
    for (const stockId of stockIds) {
      database.prepare("DELETE FROM stocks WHERE id = ?").run(stockId);
    }
    database.close();
  }
});

test("shows delivered Sony Financial shares and opens their existing stock page", async ({
  page,
}) => {
  const parentStockId = `portfolio-spin-off-parent-${Date.now()}`;
  const childStockId = `portfolio-spin-off-child-${Date.now()}`;
  const databasePath = path.join(process.cwd(), ".data/e2e-test.sqlite");
  let database: Database.Database | undefined;
  try {
    await page.goto("/");
    database = new Database(databasePath);
    database.pragma("foreign_keys = ON");
    const date = "2025-09-26T12:00:00.000Z";
    database
      .prepare(
        `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, created_at)
         VALUES (?, '6758', 'ソニーグループ', 'ソニーグループ', 'JP', 'JP', ?)`,
      )
      .run(parentStockId, date);
    database
      .prepare(
        `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, created_at)
         VALUES (?, '8729', 'ソニーフィナンシャルグループ', 'ソニーフィナンシャルグループ', 'JP', 'JP', ?)`,
      )
      .run(childStockId, date);
    database
      .prepare(
        `INSERT INTO transactions (id, stock_id, side, quantity, price, fee, executed_at, decision_id, created_at, price_currency)
         VALUES (?, ?, 'buy', 5, 1000, 0, ?, NULL, ?, 'JPY')`,
      )
      .run(
        `portfolio-spin-off-trade-${parentStockId}`,
        parentStockId,
        date,
        date,
      );
    const originalTrade = database
      .prepare("SELECT * FROM transactions WHERE stock_id = ?")
      .get(parentStockId);
    await page.goto("/portfolio");
    const childRow = page.locator("li").filter({
      has: page.getByRole("link", { name: "ソニーフィナンシャルグループ" }),
    });
    await expect(childRow).toContainText("5株");
    await expect(childRow).toContainText("206円");
    await expect(childRow).toContainText("1,030円");
    await expect(childRow).toContainText("スピンオフ");
    await expect(
      childRow.getByRole("link", { name: "ソニーフィナンシャルグループ" }),
    ).toHaveAttribute("href", `/stocks/${childStockId}`);
    await childRow
      .getByRole("link", { name: "ソニーフィナンシャルグループ" })
      .click();
    expect(
      database
        .prepare("SELECT * FROM transactions WHERE stock_id = ?")
        .get(parentStockId),
    ).toEqual(originalTrade);
    await expect(page).toHaveURL(new RegExp(`/stocks/${childStockId}$`));
    await expect(
      page.getByRole("heading", { name: "ソニーフィナンシャルグループ" }),
    ).toBeVisible();
    await page.goto("/transactions");
    await expect(
      page.locator("li").filter({ hasText: "ソニーグループ" }),
    ).toContainText("購入 · 5株 · 1,000円");
    await page.goto(`/stocks/${childStockId}`);
    await page.getByRole("link", { name: "＋ 判断を記録" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/stocks/${childStockId}/capture$`),
    );
    await expect(page.getByLabel("テキストで入力する")).toBeVisible();
  } finally {
    if (database) {
      database.pragma("foreign_keys = ON");
      database.prepare("DELETE FROM stocks WHERE id = ?").run(parentStockId);
      database.prepare("DELETE FROM stocks WHERE id = ?").run(childStockId);
      database.close();
    }
  }
});
