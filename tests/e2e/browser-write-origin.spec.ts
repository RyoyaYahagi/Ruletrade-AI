import { expect, test } from "@playwright/test";

test("rejects cross-site browser writes without changing the journal", async ({
  request,
}) => {
  const snapshot = async () => {
    const { exportedAt: _exportedAt, ...records } = await (
      await request.get("/api/export")
    ).json();
    expect(_exportedAt).toEqual(expect.any(String));
    return records;
  };
  const before = await snapshot();
  for (const path of [
    "/api/import/json",
    "/api/decisions/extract",
    "/api/decisions/transcribe",
    "/api/reviews/compare",
    "/api/import",
    "/api/feedback",
  ]) {
    const response = await request.post(path, {
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
        "content-type": "text/plain",
      },
      data: JSON.stringify({
        rawInput: "勝手に追加しない",
        message: "送信しない",
      }),
    });
    expect(response.status(), path).toBe(403);
  }
  expect(await snapshot()).toEqual(before);
});
