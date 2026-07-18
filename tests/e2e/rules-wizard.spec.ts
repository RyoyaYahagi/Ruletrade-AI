import { expect, test } from "@playwright/test";

test("新規セッションを10問のルール質問で完了直前まで進められる", async ({
  page,
}) => {
  let submittedFeedback: Record<string, unknown> | null = null;
  await page.route("**/api/rule-sessions/*/question-feedback**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { feedback: null } }),
      });
      return;
    }
    submittedFeedback = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: { feedback: { ...submittedFeedback, id: "feedback-e2e" } },
      }),
    });
  });

  await page.route("**/api/rule-sessions/*/thesis-draft", async (route) => {
    const body = [
      `event: phase\ndata: ${JSON.stringify({ phase: "researching_company", label: "企業情報を確認中" })}\n\n`,
      `event: phase\ndata: ${JSON.stringify({ phase: "verifying_sources", label: "出典箇所を確認中" })}\n\n`,
      `event: completed\ndata: ${JSON.stringify({
        thesisDraft: "私は主力事業の受注と売上の拡大を数週間から数か月で観測する。",
        thesisSegments: [
          {
            text: "私は主力事業の受注と売上の拡大を数週間から数か月で観測する。",
            sourceRefs: ["S1"],
          },
        ],
        evidence: [
          { sourceRef: "S1", quote: "主力事業は受注と売上の拡大を目指す", reason: "成長指標の確認" },
        ],
        research: {
          runId: "run-e2e",
          status: "completed",
          sources: [
            {
              ref: "S1",
              sourceType: "company_ir",
              url: "https://example.com/ir",
              title: "テスト銘柄 決算説明資料",
              publisher: "テスト銘柄",
              publishedAt: "2026-07-18",
              retrievedAt: "2026-07-18T00:00:00.000Z",
              excerpt: "主力事業は受注と売上の拡大を目指す",
              highlightText: "主力事業は受注と売上の拡大を目指す",
              verified: true,
            },
          ],
          growthDefinition: "主力事業の受注と売上が拡大すること。",
          growthIndicators: ["受注", "売上"],
          nearTermFactors: ["決算発表", "受注ニュース"],
          invalidationConditions: ["受注が減少する"],
          errors: [],
        },
        fallbackUsed: false,
      })}\n\n`,
    ].join("");
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body,
    });
  });

  await page.goto("/rules/new");
  await page.getByTestId("new-rule-ticker-input").fill("9984");
  await page.getByTestId("new-rule-company-name-input").fill("テスト銘柄");
  await page.getByTestId("new-rule-market-input").fill("TSE");
  await page.getByTestId("new-rule-submit-button").click();
  await page.waitForURL(/.*rules\/.+/, { timeout: 10000 });

  for (let questionNumber = 0; questionNumber < 10; questionNumber += 1) {
    const questionHeading = page.locator("form h2").first();
    await expect(questionHeading).toBeVisible();
    const questionText = await questionHeading.innerText();

    if (questionText.includes("投資仮説")) {
      const answerTextarea = page.getByPlaceholder("必要なら補足を書いてください");
      await expect(answerTextarea).toHaveValue(/主力事業の受注/);
      await expect(page.getByRole("heading", { name: "企業調査に基づく仮説" })).toBeVisible();
      await expect(page.getByText("主力事業は受注と売上の拡大を目指す").first()).toBeVisible();
      await expect(page.getByRole("link", { name: "S1の出典へ移動" })).toBeVisible();
      await expect(page.locator("#thesis-source-S1 mark")).toHaveText(
        "主力事業は受注と売上の拡大を目指す",
      );
      await expect(page.locator("#thesis-source-S1 a")).toHaveAttribute(
        "href",
        /#:~:text=/,
      );
      await page.getByRole("button", { name: "👍 良い質問" }).click();
      await page.getByRole("button", { name: "👍 良い選択肢" }).click();
      await page.getByRole("button", { name: "減った" }).click();
      await page
        .getByPlaceholder("例: この順番だと考えやすかった／選択肢に○○がほしい")
        .fill("企業調査付きで考える手間が減った。");
      await page.getByRole("button", { name: "フィードバックを送信" }).click();
      await expect(page.getByText("フィードバックを保存しました。")).toBeVisible();
      expect(submittedFeedback).toMatchObject({
        questionQuality: "good",
        choiceQuality: "good",
        draftEffort: "reduced",
        reason: "企業調査付きで考える手間が減った。",
        draftRunId: "run-e2e",
      });
      await answerTextarea.fill("私は事業の成長を観測する。");
      await page.getByRole("button", { name: "回答を保存" }).click();
    } else {
      await page.getByRole("button", { name: "まだ決めていない" }).click();
      await page.getByRole("button", { name: "この設定を使う" }).click();
    }

    if (questionNumber < 9) {
      await expect(page.locator("form h2").first()).not.toHaveText(questionText);
    }
  }

  await expect(
    page.getByRole("heading", { name: "質問はすべて回答済みです" }),
  ).toBeVisible();
});
