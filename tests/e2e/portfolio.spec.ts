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
        position.currency === "JPY" ? "JP" : "US",
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
    const portfolioRows = page.locator(
      'section[aria-labelledby="portfolio-holdings-heading"] li',
    );
    await expect(portfolioRows).toHaveCount(3);
    for (const position of positions.filter(
      (item) => item.currency === "JPY",
    )) {
      await expect(
        portfolioRows.filter({ hasText: position.name }),
      ).toBeVisible();
    }
    await expect(
      portfolioRows.filter({ hasText: positions[1].name }),
    ).toHaveCount(0);
    const yenRow = portfolioRows.filter({ hasText: positions[0].name });
    await expect(yenRow.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(yenRow).not.toContainText("参考平均購入単価");
    await yenRow.getByRole("button").click();
    await expect(yenRow).toContainText("参考平均購入単価");
    await expect(yenRow).toContainText("1,200円");
    await expect(yenRow).toContainText("3,002円");
    await yenRow.getByRole("link", { name: /銘柄詳細を見る/ }).click();
    await expect(page).toHaveURL(new RegExp(`/stocks/${stockIds[0]}$`));

    await page.goto("/portfolio?market=us");
    const dollarRows = page.locator(
      'section[aria-labelledby="portfolio-holdings-heading"] li',
    );
    await expect(dollarRows).toHaveCount(3);
    const dollarRow = dollarRows.filter({ hasText: positions[1].name });
    await dollarRow.getByRole("button").click();
    await expect(dollarRow).toContainText("24.12 USD");
    await expect(dollarRow).toContainText("12.06 USD");
    await expect(dollarRows.filter({ hasText: positions[0].name })).toHaveCount(
      0,
    );

    for (const width of [375, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const market of ["jp", "us"]) {
        await page.goto(`/portfolio?market=${market}`);
        const rowButton = page
          .locator(
            'section[aria-labelledby="portfolio-holdings-heading"] li button',
          )
          .first();
        await rowButton.evaluate((button, selectedMarket) => {
          const name = button.children[0].children[0];
          const amount = button.children[1].children[0];
          const profit = button.children[1].children[1];
          name.textContent =
            "キオクシアホールディングス・インターナショナル・コーポレーション";
          amount.textContent =
            selectedMarket === "jp" ? "12,345,678円" : "12,345,678.90 USD";
          profit.textContent =
            selectedMarket === "jp"
              ? "+9,876,543円 (+123.45%)"
              : "-9,876,543.21 USD (-123.45%)";
        }, market);
        await expect
          .poll(() =>
            rowButton.evaluate((button) => {
              const amount = button.children[1].getBoundingClientRect();
              return (
                document.documentElement.scrollWidth <= window.innerWidth &&
                amount.right <= window.innerWidth
              );
            }),
          )
          .toBe(true);
      }
    }

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
    const childRow = page
      .locator('section[aria-labelledby="portfolio-holdings-heading"] li')
      .filter({ hasText: "ソニーフィナンシャルグループ" });
    await childRow.getByRole("button").click();
    await expect(childRow).toContainText("5株");
    await expect(childRow).toContainText("206円");
    await expect(childRow).toContainText("1,030円");
    await expect(childRow).toContainText("スピンオフ");
    await expect(
      childRow.getByRole("link", { name: /銘柄詳細を見る/ }),
    ).toHaveAttribute("href", `/stocks/${childStockId}`);
    await childRow.getByRole("link", { name: /銘柄詳細を見る/ }).click();
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
