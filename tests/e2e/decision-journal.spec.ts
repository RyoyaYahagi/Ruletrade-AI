import { expect, test } from "@playwright/test";

test("records a decision and a written review, and keeps the sale in the ledger", async ({
  page,
}) => {
  const originalThought =
    "需要が続くと考え、100株を購入した。需要が鈍ったら見直す。";
  await page.goto("/capture/structured");
  await expect(
    page.getByRole("heading", { name: "考えを記録する" }),
  ).toBeVisible();
  await page.getByLabel("いま考えていること").fill(originalThought);
  await page.getByLabel("銘柄名").fill("架空判断テスト社");
  await page.getByLabel("証券コード（任意）").fill("JOURNAL-E2E-55");
  await page.getByLabel("記録の種類").selectOption("buy");
  await page.getByLabel("要約（任意）").fill("需要継続を想定した購入");
  await page.getByLabel("売買の事実も履歴に記録する").check();
  await page.getByLabel("数量").fill("100");
  await page.getByLabel("単価（任意）").fill("");
  await page.getByRole("button", { name: "この内容で保存" }).click();

  await expect(page).toHaveURL(/\/stocks\//);
  await expect(
    page.getByRole("heading", { name: "架空判断テスト社" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "判断タイムライン" }),
  ).toBeVisible();
  await expect(page.getByText(originalThought)).toBeVisible();
  await expect(page.getByText("購入 100株")).toBeVisible();

  await page.getByRole("link", { name: "過去と比べる" }).click();
  await page
    .getByLabel("現在の考え")
    .fill("需要の状況を確認し、保有を続ける。株価の動きだけでは売らない。");
  await page
    .getByLabel("自分の振り返り")
    .fill("前回の見直し条件に照らして考えられた。");
  await page.getByLabel("売却判断と取引も記録する").check();
  await page.getByLabel("売却数量").fill("25");
  await page.getByRole("button", { name: "振り返りを保存" }).click();
  await expect(page).toHaveURL(/\/stocks\/.*tab=reviews/);
  await expect(
    page.getByText("前回の見直し条件に照らして考えられた。"),
  ).toBeVisible();

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "売買履歴" })).toBeVisible();

  await page.goto("/more");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "JSONをエクスポート" }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const exported = await page.request
    .get("/api/export")
    .then((response) => response.json());
  expect(exported.decisions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rawInput: originalThought }),
    ]),
  );
  expect(exported.reviews).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        reflection: "前回の見直し条件に照らして考えられた。",
      }),
    ]),
  );
  const decision = exported.decisions.find(
    (row: { rawInput: string }) => row.rawInput === originalThought,
  );
  expect(
    exported.transactions
      .filter((row: { stockId: string }) => row.stockId === decision.stockId)
      .map((row: { side: string; quantity: number }) => [
        row.side,
        row.quantity,
      ]),
  ).toEqual([
    ["buy", 100],
    ["sell", 25],
  ]);
});
