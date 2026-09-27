import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/feedback/route";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("JEV_GATEWAY_URL", "");
  vi.stubEnv("TYPESAFE_API_KEY", "");
  vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "github-secret");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function request(value: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(value),
  });
}
it("sends successfully without Jev and exposes no secrets", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ number: 31 }))
    .mockResolvedValueOnce(Response.json({}));
  const response = await POST(
    request({ message: "困っています", inputMethod: "text" }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    number: 31,
    url: "https://github.com/RyoyaYahagi/Ruletrade-AI/issues/31",
  });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).body).toContain(
    '"classificationSource": "none"',
  );
});
it("uses a safe error for GitHub failure", async () => {
  fetchMock.mockResolvedValue(
    new Response("github-secret internal error", { status: 500 }),
  );
  const response = await POST(
    request({ message: "困っています", inputMethod: "voice" }),
  );
  expect(response.status).toBe(502);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
});
it.each([
  { message: "  ", inputMethod: "text" },
  { message: "あ".repeat(10001), inputMethod: "text" },
  { message: "問題", inputMethod: "unknown" },
])("rejects invalid input before external calls", async (input) => {
  expect((await POST(request(input))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects cross-site requests including a same-site different origin", async () => {
  expect(
    (
      await POST(
        request(
          { message: "問題", inputMethod: "text" },
          { origin: "https://evil.example" },
        ),
      )
    ).status,
  ).toBe(403);
  expect(
    (await POST(request({}, { "sec-fetch-site": "cross-site" }))).status,
  ).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("accepts the host forwarded by the HTTPS proxy", async () => {
  fetchMock
    .mockResolvedValueOnce(Response.json({ number: 32 }))
    .mockResolvedValueOnce(Response.json({}));
  expect(
    (
      await POST(
        request(
          { message: "問題", inputMethod: "text" },
          {
            origin: "https://ruletrade.example",
            "x-forwarded-host": "ruletrade.example",
            host: "localhost",
          },
        ),
      )
    ).status,
  ).toBe(200);
});
it("rejects oversized bodies and malformed JSON", async () => {
  expect((await POST(request({ message: "x".repeat(70000) }))).status).toBe(
    413,
  );
  expect(
    (
      await POST(
        new Request("http://localhost/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      )
    ).status,
  ).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["api_error", "invalid_schema", "network_error"])(
  "still creates an issue when Jev returns %s",
  async (failure) => {
    vi.stubEnv("TYPESAFE_API_KEY", "jev-secret");
    if (failure === "api_error")
      fetchMock.mockResolvedValueOnce(
        new Response("jev-secret", { status: 503 }),
      );
    if (failure === "invalid_schema")
      fetchMock.mockResolvedValueOnce(
        Response.json({ answers: { severity: { score: 99 } } }),
      );
    if (failure === "network_error")
      fetchMock.mockRejectedValueOnce(new Error("jev-secret"));
    fetchMock
      .mockResolvedValueOnce(Response.json({ number: 33 }))
      .mockResolvedValueOnce(Response.json({}));
    const response = await POST(
      request({ message: "音声の入力が動きません。", inputMethod: "voice" }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).number).toBe(33);
    const issue = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(issue.body).toContain("音声の入力が動きません。");
    expect(issue.body).toContain('"classificationSource": "none"');
    expect(issue.body).not.toContain("jev-secret");
  },
);
