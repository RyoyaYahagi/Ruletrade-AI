import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __feedbackStopCount?: number;
    __feedbackResolveMic?: () => void;
  }
}

test("keeps feedback after a failed send and lets the user start another inquiry", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/feedback", async (route) => {
    attempts += 1;
    const body = route.request().postDataJSON() as { message: string; inputMethod: string };
    expect(body).toEqual(attempts <= 2
      ? { message: "検索結果を絞り込めるようにしてほしいです。", inputMethod: "text" }
      : { message: "次の問い合わせです。", inputMethod: "text" });
    if (attempts === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", json: { error: "送信できませんでした。" } });
      return;
    }
    await route.fulfill({ status: 201, contentType: "application/json", json: { number: attempts + 40, url: `https://github.com/example/repo/issues/${attempts + 40}` } });
  });

  await page.goto("/more");
  await page.getByRole("button", { name: "お問い合わせ・改善要望" }).click();
  const dialog = page.getByRole("dialog", { name: "お問い合わせ・改善要望" });
  await expect(dialog.getByRole("button", { name: "送信する" })).toBeDisabled();
  await dialog.getByLabel("お問い合わせ内容").fill("   ");
  await expect(dialog.getByRole("button", { name: "送信する" })).toBeDisabled();
  await page.screenshot({ path: "test-results/feedback-dialog-desktop.png" });
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(1280);
  await page.setViewportSize({ width: 320, height: 720 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/feedback-dialog-320.png" });
  const narrowDialogBox = await dialog.boundingBox();
  expect(narrowDialogBox).not.toBeNull();
  expect(narrowDialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(narrowDialogBox!.x + narrowDialogBox!.width).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByLabel("お問い合わせ内容").fill("検索結果を絞り込めるようにしてほしいです。");
  await dialog.getByRole("button", { name: "送信する" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("送信できませんでした。");
  await expect(dialog.getByLabel("お問い合わせ内容")).toHaveValue("検索結果を絞り込めるようにしてほしいです。");
  await dialog.getByRole("button", { name: "送信する" }).click();
  await expect(dialog.getByText("送信しました（#42）")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "受付内容を確認" })).toHaveAttribute("href", "https://github.com/example/repo/issues/42");
  await dialog.getByRole("button", { name: "新しい問い合わせを送る" }).click();
  await expect(dialog.getByLabel("お問い合わせ内容")).toHaveValue("");
  await dialog.getByLabel("お問い合わせ内容").fill("次の問い合わせです。");
  await dialog.getByRole("button", { name: "送信する" }).click();
  await expect(dialog.getByText("送信しました（#43）")).toBeVisible();
  expect(attempts).toBe(3);
});

test("transcribes spoken feedback into an editable field before sending", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
    });
    class FixtureMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported() { return true; }
      constructor() {}
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["voice fixture"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FixtureMediaRecorder });
  });
  let feedbackSubmissions = 0;
  await page.route("**/api/decisions/transcribe", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ status: 200, contentType: "application/json", json: { transcript: "履歴に検索機能がほしいです。" } });
  });
  await page.route("**/api/feedback", async (route) => {
    feedbackSubmissions += 1;
    expect(route.request().postDataJSON()).toEqual({ message: "履歴に検索機能を追加してほしいです。", inputMethod: "voice" });
    await route.fulfill({ status: 201, contentType: "application/json", json: { number: 43, url: "https://github.com/example/repo/issues/43" } });
  });

  await page.goto("/more");
  await page.getByRole("button", { name: "お問い合わせ・改善要望" }).click();
  const dialog = page.getByRole("dialog", { name: "お問い合わせ・改善要望" });
  await dialog.getByRole("button", { name: "話して入力" }).click();
  await expect(dialog.getByRole("button", { name: "送信する" })).toBeDisabled();
  expect(feedbackSubmissions).toBe(0);
  await dialog.getByRole("button", { name: "録音を停止" }).click();
  await expect(dialog.getByRole("button", { name: "送信する" })).toBeDisabled();
  expect(feedbackSubmissions).toBe(0);
  const input = dialog.getByLabel("お問い合わせ内容");
  await expect(input).toHaveValue("履歴に検索機能がほしいです。");
  await input.fill("履歴に検索機能を追加してほしいです。");
  await dialog.getByRole("button", { name: "送信する" }).click();
  await expect(dialog.getByText("送信しました（#43）")).toBeVisible();
});

test("stops an active microphone when the dialog closes", async ({ page }) => {
  await page.addInitScript(() => {
    window.__feedbackStopCount = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop() { window.__feedbackStopCount! += 1; } }] }) },
    });
    class FixtureMediaRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      static isTypeSupported() { return true; }
      constructor() {}
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.onstop?.(); }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FixtureMediaRecorder });
  });

  await page.goto("/more");
  await page.getByRole("button", { name: "お問い合わせ・改善要望" }).click();
  const dialog = page.getByRole("dialog", { name: "お問い合わせ・改善要望" });
  await dialog.getByRole("button", { name: "話して入力" }).click();
  await dialog.getByRole("button", { name: "録音を停止" }).click();
  await expect.poll(() => page.evaluate(() => window.__feedbackStopCount)).toBe(1);
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "お問い合わせ・改善要望" }).click();
  await expect(dialog.getByRole("button", { name: "話して入力" })).toBeEnabled();
});

test("stops a microphone stream that resolves after the dialog closes", async ({ page }) => {
  await page.addInitScript(() => {
    window.__feedbackStopCount = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => new Promise((resolve) => {
          window.__feedbackResolveMic = () => resolve({
            getTracks: () => [{ stop() { window.__feedbackStopCount! += 1; } }],
          } as unknown as MediaStream);
        }),
      },
    });
    class FixtureMediaRecorder {
      static isTypeSupported() { return true; }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FixtureMediaRecorder });
  });

  await page.goto("/more");
  await page.getByRole("button", { name: "お問い合わせ・改善要望" }).click();
  const dialog = page.getByRole("dialog", { name: "お問い合わせ・改善要望" });
  await dialog.getByRole("button", { name: "話して入力" }).click();
  await expect(dialog.getByRole("button", { name: "話して入力" })).toBeDisabled();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.evaluate(() => window.__feedbackResolveMic?.());
  await expect.poll(() => page.evaluate(() => window.__feedbackStopCount)).toBe(1);
});
