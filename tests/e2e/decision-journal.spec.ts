import { expect, test } from "@playwright/test";

const originalThought =
  "キオクシアを100株買った。AI向けNAND需要に期待している。データセンター需要が鈍ったら見直す。次の決算でも需要が強ければ買い増したい。";
const extraction = {
  type: "buy",
  stock: { ticker: "285A", name: "キオクシア", market: "JP" },
  thesis: "AI向けNAND需要に期待",
  assumptions: ["AI向け需要が続く"],
  reviewConditions: ["データセンター需要が鈍る"],
  addConditions: ["次の決算でも需要が強い"],
  transaction: {
    side: "buy",
    quantity: 100,
    price: null,
    fee: null,
    executedAt: "2025-01-10T00:00:00.000Z",
  },
  followUpQuestion: null,
};

test("records a decision, compares it with the past, reviews a sale, and shows the transaction history", async ({ page }) => {
  await page.route("**/api/decisions/extract", async (route) => {
    const requestBody = route.request().postDataJSON() as { rawInput: string };
    expect(requestBody.rawInput).toBe(originalThought);
    await route.fulfill({ status: 200, contentType: "application/json", json: extraction });
  });

  await page.route("**/api/reviews/compare", async (route) => {
    const requestBody = route.request().postDataJSON() as { currentInput: string };
    expect(requestBody.currentInput).toBe("キオクシアがかなり下がったから売ろうかな。");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        summary: "購入時は需要の鈍化を見直し条件にしていました。今回は株価下落が理由として挙がっています。",
        differences: ["事業上の需要変化ではなく、株価下落が売却検討の理由です。"],
      },
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "いま何を考えていますか？" })).toBeVisible();
  await page.screenshot({ path: "test-results/mvp-home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mvp-home-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByLabel("テキストで入力する").fill(originalThought);
  await page.getByRole("button", { name: "内容を整理する" }).click();
  await expect(page.getByRole("heading", { name: "整理した内容を確認してください" })).toBeVisible();
  await expect(page.getByLabel("数量")).toHaveValue("100");
  await expect(page.getByLabel("単価")).toHaveValue("");
  await page.getByRole("button", { name: "日付指定" }).click();
  await page.getByLabel("振り返り日").fill("2025-01-01");
  await page.screenshot({ path: "test-results/mvp-confirmation.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mvp-confirmation-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "この内容で保存" }).click();

  await expect(page).toHaveURL(/\/stocks\//);
  await expect(page.getByRole("heading", { name: "キオクシア" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "判断タイムライン" })).toBeVisible();
  await expect(page.getByText("AI向けNAND需要に期待", { exact: true })).toBeVisible();
  await expect(page.getByText("データセンター需要が鈍る")).toBeVisible();
  await expect(page.getByText("購入 100株")).toBeVisible();
  await expect(page.getByText("価格未入力").first()).toBeVisible();
  await page.screenshot({ path: "test-results/mvp-stock-timeline.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mvp-stock-timeline-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByLabel("現在の考え").fill("キオクシアがかなり下がったから売ろうかな。");
  await page.getByRole("button", { name: "過去の判断と比べる" }).click();
  await expect(page.getByRole("heading", { name: "過去の判断との比較" })).toBeVisible();
  await expect(page.getByText(/株価下落が理由として挙がっています/)).toBeVisible();
  await page.getByLabel("自分の振り返り").fill("需要の見直し条件を確かめてから、自分で判断する。");
  await page.getByLabel("売却判断と取引も記録する").check();
  await page.getByLabel("売却数量").fill("100");
  await page.getByRole("button", { name: "比較と振り返りを保存" }).click();

  await expect(page.getByRole("heading", { name: "過去の振り返り" })).toBeVisible();
  await expect(page.getByText("需要の見直し条件を確かめてから、自分で判断する。")).toBeVisible();
  await expect(page.getByText("売却 100株")).toBeVisible();
  await page.screenshot({ path: "test-results/mvp-stock-review-and-sale.png", fullPage: true });

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "売買履歴" })).toBeVisible();
  await expect(page.getByText("判断メモ:", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("キオクシア").first()).toBeVisible();
  await page.screenshot({ path: "test-results/mvp-transactions.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mvp-transactions-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "レビュー時期です" })).toBeVisible();
  await expect(page.getByText("キオクシア").first()).toBeVisible();
});

test("transcribes a voice capture fixture and lets the user review the text", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
      },
    });
    class FixtureMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor() {}

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["voice fixture"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: FixtureMediaRecorder,
    });
  });
  await page.route("**/api/decisions/transcribe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { transcript: "キオクシアを100株買った。" },
    });
  });
  await page.route("**/api/decisions/extract", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { ...extraction, thesis: "音声からの投資仮説" },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "話して記録" }).click();
  await page.getByRole("button", { name: "録音を停止" }).click();
  await expect(page.getByLabel("テキストで入力する")).toHaveValue("キオクシアを100株買った。");
  await page.getByLabel("テキストで入力する").fill("キオクシアを100株買った。理由はAI需要。");
  await page.getByRole("button", { name: "内容を整理する" }).click();
  await expect(page.getByRole("heading", { name: "整理した内容を確認してください" })).toBeVisible();
  await expect(page.getByText("音声からの投資仮説")).toBeVisible();
  await expect(page.getByText("編集前の文字起こし原文")).toBeVisible();
});
